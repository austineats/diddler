/**
 * Bit7Bridge — Standalone IMCore bridge.
 *
 * Runs as its own process (no injection needed).
 * Loads IMCore.framework via dlopen (requires SIP disabled).
 * Messages.app must be running alongside so imagent has full account state.
 * Exposes localhost:5050 for typing indicators and read receipts.
 */

#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <dlfcn.h>
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>

// IMCore forward declarations (classes registered after dlopen)
@interface IMChat : NSObject
+ (instancetype)chatForIMHandle:(id)handle;
- (void)setLocalUserIsTyping:(BOOL)typing;
- (void)markAllMessagesAsRead;
- (NSString *)guid;
- (NSArray *)participants;
@end

@interface IMHandle : NSObject
- (NSString *)ID;
@end

@interface IMAccountController : NSObject
+ (instancetype)sharedInstance;
- (NSArray *)accounts;
@end

@interface IMAccount : NSObject
- (id)imHandleWithID:(NSString *)handleID;
- (BOOL)isConnected;
- (NSString *)serviceName;
@end

@interface IMChatRegistry : NSObject
+ (instancetype)sharedInstance;
- (IMChat *)existingChatForIMHandle:(id)handle;
- (IMChat *)chatForIMHandle:(id)handle;
- (NSArray *)allExistingChats;
- (IMChat *)existingChatWithGUID:(NSString *)guid;
@end

@interface IMDaemonController : NSObject
+ (instancetype)sharedInstance;
- (void)connectToDaemon;
- (void)connectToDaemonWithLaunch:(BOOL)launch;
- (BOOL)isConnected;
@end

static int serverPort = 5050;

#pragma mark - IMCore Helpers

static IMChat *getChatForIdentifier(NSString *identifier) {
    Class registryClass = objc_getClass("IMChatRegistry");
    Class accountCtrlClass = objc_getClass("IMAccountController");

    if (!registryClass || !accountCtrlClass) {
        NSLog(@"[Bit7Bridge] IMCore classes not available yet");
        return nil;
    }

    id registry = [registryClass sharedInstance];
    if (!registry) return nil;

    // Try direct GUID lookup first (e.g. "iMessage;-;+1234567890")
    IMChat *chat = [registry existingChatWithGUID:identifier];
    if (chat) return chat;

    // Strip "iMessage;-;" prefix for handle lookup
    NSString *handleID = identifier;
    if ([handleID hasPrefix:@"iMessage;-;"]) {
        handleID = [handleID substringFromIndex:[@"iMessage;-;" length]];
    }

    id accountCtrl = [accountCtrlClass sharedInstance];
    NSArray *accounts = [accountCtrl accounts];
    NSLog(@"[Bit7Bridge] Looking up chat for %@ across %lu accounts", handleID, (unsigned long)accounts.count);

    for (id account in accounts) {
        if (![[account serviceName] isEqualToString:@"iMessage"]) continue;
        if (![account isConnected]) continue;

        @try {
            id handle = [account imHandleWithID:handleID];
            if (handle) {
                chat = [registry existingChatForIMHandle:handle];
                if (!chat) chat = [registry chatForIMHandle:handle];
                if (chat) return chat;
            }
        } @catch (NSException *e) {
            NSLog(@"[Bit7Bridge] Exception: %@", e);
        }
    }

    NSLog(@"[Bit7Bridge] No chat found for: %@", identifier);
    return nil;
}

#pragma mark - HTTP Server

static NSDictionary *parseJSONBody(NSData *body) {
    if (!body || body.length == 0) return nil;
    id json = [NSJSONSerialization JSONObjectWithData:body options:0 error:nil];
    return [json isKindOfClass:[NSDictionary class]] ? json : nil;
}

static NSData *jsonResponse(NSDictionary *dict) {
    return [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
}

static void handleRequest(NSString *method, NSString *path, NSData *body, int sock) {
    NSData *responseData;
    int status = 200;

    if ([path isEqualToString:@"/health"] && [method isEqualToString:@"GET"]) {
        responseData = jsonResponse(@{@"ok": @YES, @"bridge": @"bit7", @"version": @"1.0"});

    } else if ([path isEqualToString:@"/debug"] && [method isEqualToString:@"GET"]) {
        Class registryClass = objc_getClass("IMChatRegistry");
        Class accountCtrlClass = objc_getClass("IMAccountController");
        NSMutableArray *chatList = [NSMutableArray array];
        NSMutableArray *accountList = [NSMutableArray array];
        if (registryClass) {
            id registry = [registryClass sharedInstance];
            NSArray *chats = [registry allExistingChats];
            for (IMChat *c in chats) {
                [chatList addObject:@{
                    @"guid": [c guid] ?: @"nil",
                    @"participants": [[c participants] valueForKey:@"ID"] ?: @[]
                }];
            }
        }
        if (accountCtrlClass) {
            id ctrl = [accountCtrlClass sharedInstance];
            for (id account in [ctrl accounts]) {
                [accountList addObject:@{
                    @"service": [account serviceName] ?: @"nil",
                    @"connected": @([account isConnected])
                }];
            }
        }
        responseData = jsonResponse(@{@"ok": @YES, @"chats": chatList, @"accounts": accountList});

    } else if ([path isEqualToString:@"/typing/start"] && [method isEqualToString:@"POST"]) {
        NSString *chat = parseJSONBody(body)[@"chat"];
        IMChat *imChat = chat ? getChatForIdentifier(chat) : nil;
        if (imChat) {
            [imChat setLocalUserIsTyping:YES];
            responseData = jsonResponse(@{@"ok": @YES});
            NSLog(@"[Bit7Bridge] Started typing for: %@", chat);
        } else {
            status = 404;
            responseData = jsonResponse(@{@"ok": @NO, @"error": @"chat not found"});
        }

    } else if ([path isEqualToString:@"/typing/stop"] && [method isEqualToString:@"POST"]) {
        NSString *chat = parseJSONBody(body)[@"chat"];
        IMChat *imChat = chat ? getChatForIdentifier(chat) : nil;
        if (imChat) {
            [imChat setLocalUserIsTyping:NO];
            responseData = jsonResponse(@{@"ok": @YES});
            NSLog(@"[Bit7Bridge] Stopped typing for: %@", chat);
        } else {
            status = 404;
            responseData = jsonResponse(@{@"ok": @NO, @"error": @"chat not found"});
        }

    } else if ([path isEqualToString:@"/read"] && [method isEqualToString:@"POST"]) {
        NSString *chat = parseJSONBody(body)[@"chat"];
        IMChat *imChat = chat ? getChatForIdentifier(chat) : nil;
        if (imChat) {
            [imChat markAllMessagesAsRead];
            responseData = jsonResponse(@{@"ok": @YES});
            NSLog(@"[Bit7Bridge] Marked read: %@", chat);
        } else {
            status = 404;
            responseData = jsonResponse(@{@"ok": @NO, @"error": @"chat not found"});
        }

    } else {
        status = 404;
        responseData = jsonResponse(@{@"ok": @NO, @"error": @"not found"});
    }

    NSString *statusText = status == 200 ? @"OK" : status == 404 ? @"Not Found" : @"Bad Request";
    NSString *header = [NSString stringWithFormat:
        @"HTTP/1.1 %d %@\r\nContent-Type: application/json\r\nContent-Length: %lu\r\nConnection: close\r\n\r\n",
        status, statusText, (unsigned long)responseData.length];
    NSData *headerData = [header dataUsingEncoding:NSUTF8StringEncoding];
    send(sock, headerData.bytes, headerData.length, 0);
    send(sock, responseData.bytes, responseData.length, 0);
    close(sock);
}

static void startHTTPServer(void) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        int serverSocket = socket(AF_INET, SOCK_STREAM, 0);
        int opt = 1;
        setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        struct sockaddr_in addr = {0};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = htons(serverPort);

        if (bind(serverSocket, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
            NSLog(@"[Bit7Bridge] Failed to bind port %d", serverPort);
            return;
        }
        listen(serverSocket, 10);
        NSLog(@"[Bit7Bridge] Listening on localhost:%d", serverPort);

        while (1) {
            int clientSocket = accept(serverSocket, NULL, NULL);
            if (clientSocket < 0) continue;
            dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                char buffer[8192];
                ssize_t n = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
                if (n <= 0) { close(clientSocket); return; }
                buffer[n] = '\0';
                NSString *raw = [NSString stringWithUTF8String:buffer];
                NSArray *lines = [raw componentsSeparatedByString:@"\r\n"];
                if (!lines.count) { close(clientSocket); return; }
                NSArray *rl = [lines[0] componentsSeparatedByString:@" "];
                if (rl.count < 2) { close(clientSocket); return; }
                NSString *method = rl[0], *path = rl[1];
                NSData *bodyData = nil;
                NSRange br = [raw rangeOfString:@"\r\n\r\n"];
                if (br.location != NSNotFound)
                    bodyData = [[raw substringFromIndex:br.location + 4] dataUsingEncoding:NSUTF8StringEncoding];
                dispatch_async(dispatch_get_main_queue(), ^{
                    handleRequest(method, path, bodyData, clientSocket);
                });
            });
        }
    });
}

#pragma mark - Main

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSLog(@"[Bit7Bridge] Loading IMCore.framework...");

        void *handle = dlopen(
            "/System/Library/PrivateFrameworks/IMCore.framework/IMCore",
            RTLD_LAZY
        );
        if (!handle) {
            NSLog(@"[Bit7Bridge] FATAL: Cannot load IMCore: %s", dlerror());
            NSLog(@"[Bit7Bridge] Is SIP disabled? Run: csrutil status");
            return 1;
        }
        NSLog(@"[Bit7Bridge] IMCore loaded");

        // Connect to imagent daemon — required for IMCore to work
        Class daemonClass = objc_getClass("IMDaemonController");
        if (daemonClass) {
            id daemon = [daemonClass sharedInstance];
            NSLog(@"[Bit7Bridge] Connecting to imagent daemon...");
            [daemon connectToDaemonWithLaunch:YES];

            // Wait for connection with timeout
            for (int i = 0; i < 30; i++) {
                if ([daemon isConnected]) {
                    NSLog(@"[Bit7Bridge] Connected to imagent daemon");
                    break;
                }
                [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.5]];
            }
            if (![daemon isConnected]) {
                NSLog(@"[Bit7Bridge] WARNING: Could not connect to imagent daemon after 15s");
            }
        } else {
            NSLog(@"[Bit7Bridge] WARNING: IMDaemonController class not found");
        }

        // Wait for accounts to populate
        NSLog(@"[Bit7Bridge] Waiting for accounts...");
        sleep(2);

        // Log available accounts
        Class accountCtrlClass = objc_getClass("IMAccountController");
        if (accountCtrlClass) {
            id ctrl = [accountCtrlClass sharedInstance];
            NSArray *accounts = [ctrl accounts];
            NSLog(@"[Bit7Bridge] Accounts available: %lu", (unsigned long)accounts.count);
            for (id account in accounts) {
                NSLog(@"[Bit7Bridge] Account: %@ connected=%d", [account serviceName], (int)[account isConnected]);
            }
        }

        startHTTPServer();

        NSLog(@"[Bit7Bridge] Running. Press Ctrl+C to stop.");
        [[NSRunLoop mainRunLoop] run];
    }
    return 0;
}
