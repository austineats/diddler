/**
 * Bit7BridgeServer — Standalone IMCore HTTP bridge.
 * Runs as its own process (no injection needed).
 * Exposes localhost:5050 for typing indicators and read receipts.
 */

#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>
#include <dlfcn.h>

// IMCore forward declarations
@interface IMChat : NSObject
- (void)setLocalUserIsTyping:(BOOL)typing;
- (void)markAllMessagesAsRead;
- (NSString *)guid;
@end

@interface IMHandle : NSObject
- (NSString *)ID;
@end

@interface IMDaemonController : NSObject
+ (instancetype)sharedInstance;
- (void)connectToDaemonAsynchronouslyWithCompletion:(void (^)(BOOL success))completion;
- (BOOL)connectToDaemon;
@end

@interface IMAccountController : NSObject
+ (instancetype)sharedInstance;
- (NSArray *)accounts;
- (id)activeiMessageAccount;
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
- (IMChat *)existingChatWithGUID:(NSString *)guid;
@end

static int serverPort = 5050;

static IMChat *getChatForIdentifier(NSString *identifier) {
    IMChatRegistry *registry = [IMChatRegistry sharedInstance];
    if (!registry) return nil;

    IMChat *chat = [registry existingChatWithGUID:identifier];
    if (chat) return chat;

    // Strip "iMessage;-;" prefix for handle lookup
    NSString *handleID = identifier;
    if ([handleID hasPrefix:@"iMessage;-;"]) {
        handleID = [handleID substringFromIndex:[@"iMessage;-;" length]];
    }

    IMAccountController *accountCtrl = [IMAccountController sharedInstance];

    // Try active iMessage account first
    @try {
        id activeAccount = [accountCtrl activeiMessageAccount];
        NSLog(@"[Bit7Bridge] Active iMessage account: %@", activeAccount);
        if (activeAccount) {
            id handle = [activeAccount imHandleWithID:handleID];
            if (handle) {
                chat = [registry existingChatForIMHandle:handle];
                if (!chat) chat = [registry chatForIMHandle:handle];
                if (chat) return chat;
            }
        }
    } @catch (NSException *e) {
        NSLog(@"[Bit7Bridge] activeiMessageAccount error: %@", e);
    }

    // Fall back to iterating all accounts
    for (IMAccount *account in [accountCtrl accounts]) {
        if (![[account serviceName] isEqualToString:@"iMessage"]) continue;
        @try {
            id handle = [account imHandleWithID:handleID];
            if (handle) {
                chat = [registry existingChatForIMHandle:handle];
                if (!chat) chat = [registry chatForIMHandle:handle];
                if (chat) return chat;
            }
        } @catch (NSException *e) {}
    }
    return nil;
}

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
        responseData = jsonResponse(@{@"ok": @YES, @"bridge": @"bit7-standalone", @"version": @"1.0"});
    } else if ([path isEqualToString:@"/typing/start"] && [method isEqualToString:@"POST"]) {
        NSString *chat = parseJSONBody(body)[@"chat"];
        IMChat *imChat = chat ? getChatForIdentifier(chat) : nil;
        if (imChat) {
            [imChat setLocalUserIsTyping:YES];
            responseData = jsonResponse(@{@"ok": @YES});
            NSLog(@"[Bit7Bridge] Started typing: %@", chat);
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
            NSLog(@"[Bit7Bridge] Stopped typing: %@", chat);
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

static void startServer(void) {
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

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSLog(@"[Bit7Bridge] Starting standalone bridge...");

        // Load IMCore
        void *imcore = dlopen("/System/Library/PrivateFrameworks/IMCore.framework/IMCore", RTLD_LAZY);
        if (!imcore) {
            NSLog(@"[Bit7Bridge] Failed to load IMCore: %s", dlerror());
            return 1;
        }
        NSLog(@"[Bit7Bridge] IMCore loaded");

        // Connect to imagent daemon first, then start server
        IMDaemonController *daemon = [IMDaemonController sharedInstance];
        NSLog(@"[Bit7Bridge] Connecting to imagent...");
        BOOL daemonConnected = [daemon connectToDaemon];
        NSLog(@"[Bit7Bridge] imagent connected: %d", daemonConnected);
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC),
                       dispatch_get_main_queue(), ^{
            IMAccountController *ctrl = [IMAccountController sharedInstance];
            NSLog(@"[Bit7Bridge] IMAccountController: %@", ctrl);
            for (IMAccount *account in [ctrl accounts]) {
                NSLog(@"[Bit7Bridge] Account: %@ connected=%d", [account serviceName], [account isConnected]);
            }
            startServer();
        });

        [[NSRunLoop mainRunLoop] run];
    }
    return 0;
}
