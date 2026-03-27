/**
 * TypingInjector — DYLIB injected into Messages.app to call setLocalUserIsTyping.
 *
 * Build: clang -dynamiclib -framework Foundation -o TypingInjector.dylib TypingInjector.m -fobjc-arc
 * Inject: DYLD_INSERT_LIBRARIES=./TypingInjector.dylib /System/Applications/Messages.app/Contents/MacOS/Messages
 *
 * Once loaded inside Messages.app, starts a tiny HTTP server on port 5051
 * that accepts /typing/start and /typing/stop with {"chat": "phone_or_guid"}.
 * Since we're inside Messages.app, IMCore has full access.
 */
#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#include <errno.h>
#import <sys/socket.h>
#import <netinet/in.h>
#import <arpa/inet.h>

@interface IMChat : NSObject
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
- (IMChat *)existingChatWithChatIdentifier:(NSString *)identifier;
@end

static IMChat *findChat(NSString *identifier) {
    id registry = [NSClassFromString(@"IMChatRegistry") sharedInstance];
    if (!registry) return nil;

    // Try chatIdentifier first (this is what worked in lldb)
    NSString *cleanID = identifier;
    if ([cleanID hasPrefix:@"iMessage;-;"]) cleanID = [cleanID substringFromIndex:11];
    if ([cleanID hasPrefix:@"any;-;"]) cleanID = [cleanID substringFromIndex:6];

    IMChat *chat = [registry existingChatWithChatIdentifier:cleanID];
    if (chat) return chat;

    // Try GUID
    chat = [registry existingChatWithGUID:identifier];
    if (chat) return chat;

    // Strip prefix
    NSString *handleID = identifier;
    if ([handleID hasPrefix:@"iMessage;-;"]) {
        handleID = [handleID substringFromIndex:11];
    }
    if ([handleID hasPrefix:@"any;-;"]) {
        handleID = [handleID substringFromIndex:6];
    }

    // Try all accounts
    id ctrl = [NSClassFromString(@"IMAccountController") sharedInstance];
    for (id account in [ctrl accounts]) {
        @try {
            id handle = [account imHandleWithID:handleID];
            if (handle) {
                chat = [registry existingChatForIMHandle:handle];
                if (!chat) chat = [registry chatForIMHandle:handle];
                if (chat) {
                    NSLog(@"[TypingInjector] Found chat for %@ via %@", handleID, [account serviceName]);
                    return chat;
                }
            }
        } @catch (NSException *e) {}
    }

    NSLog(@"[TypingInjector] No chat for: %@", identifier);
    return nil;
}

static NSDictionary *parseJSON(NSData *data) {
    if (!data || data.length == 0) return nil;
    id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    return [obj isKindOfClass:[NSDictionary class]] ? obj : nil;
}

static void startTypingServer(void) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        int opt = 1;
        setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        struct sockaddr_in addr = {0};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = htons(5055);

        if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
            NSLog(@"[TypingInjector] Failed to bind port 5055: errno=%d (%s)", errno, strerror(errno));
            return;
        }
        listen(sock, 10);
        NSLog(@"[TypingInjector] Listening on localhost:5055 (inside Messages.app)");

        while (1) {
            int client = accept(sock, NULL, NULL);
            if (client < 0) continue;
            dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                char buf[4096];
                ssize_t n = recv(client, buf, sizeof(buf)-1, 0);
                if (n <= 0) { close(client); return; }
                buf[n] = '\0';

                NSString *raw = [NSString stringWithUTF8String:buf];
                NSArray *lines = [raw componentsSeparatedByString:@"\r\n"];
                NSArray *rl = [lines[0] componentsSeparatedByString:@" "];
                NSString *method = rl[0], *path = rl.count > 1 ? rl[1] : @"";

                NSData *body = nil;
                NSRange br = [raw rangeOfString:@"\r\n\r\n"];
                if (br.location != NSNotFound)
                    body = [[raw substringFromIndex:br.location+4] dataUsingEncoding:NSUTF8StringEncoding];

                NSData *resp;
                if ([path isEqualToString:@"/health"]) {
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@YES, @"injected":@YES} options:0 error:nil];
                } else if ([path isEqualToString:@"/typing/start"]) {
                    NSString *chatId = parseJSON(body)[@"chat"];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        IMChat *chat = findChat(chatId);
                        if (chat) {
                            [chat setLocalUserIsTyping:YES];
                            NSLog(@"[TypingInjector] setLocalUserIsTyping:YES for %@", chatId);
                        }
                    });
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@YES} options:0 error:nil];
                } else if ([path isEqualToString:@"/typing/stop"]) {
                    NSString *chatId = parseJSON(body)[@"chat"];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        IMChat *chat = findChat(chatId);
                        if (chat) {
                            [chat setLocalUserIsTyping:NO];
                            NSLog(@"[TypingInjector] setLocalUserIsTyping:NO for %@", chatId);
                        }
                    });
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@YES} options:0 error:nil];
                } else if ([path isEqualToString:@"/read"]) {
                    NSString *chatId = parseJSON(body)[@"chat"];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        IMChat *chat = findChat(chatId);
                        if (chat) {
                            [chat markAllMessagesAsRead];
                            NSLog(@"[TypingInjector] markAllMessagesAsRead for %@", chatId);
                        }
                    });
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@YES} options:0 error:nil];
                } else if ([path isEqualToString:@"/chats"]) {
                    id registry = [NSClassFromString(@"IMChatRegistry") sharedInstance];
                    NSArray *chats = [registry allExistingChats];
                    NSMutableArray *list = [NSMutableArray array];
                    for (IMChat *c in chats) {
                        [list addObject:@{@"guid": [c guid] ?: @"?", @"participants": [[c participants] valueForKey:@"ID"] ?: @[]}];
                    }
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@YES, @"count":@(chats.count), @"chats":list} options:0 error:nil];
                } else {
                    resp = [NSJSONSerialization dataWithJSONObject:@{@"ok":@NO} options:0 error:nil];
                }

                NSString *header = [NSString stringWithFormat:@"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %lu\r\nConnection: close\r\n\r\n", (unsigned long)resp.length];
                send(client, [header UTF8String], header.length, 0);
                send(client, resp.bytes, resp.length, 0);
                close(client);
            });
        }
    });
}

// ---------------------------------------------------------------------------
// File-based IPC — watches /tmp/bit7_typing for commands
// Format: "start:+19498221179" or "stop:+19498221179"
// ---------------------------------------------------------------------------

static void startFileWatcher(void) {
    NSString *cmdFile = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Messages/bit7_typing"];
    // Create file if needed
    if (![[NSFileManager defaultManager] fileExistsAtPath:cmdFile]) {
        [[NSFileManager defaultManager] createFileAtPath:cmdFile contents:nil attributes:nil];
    }

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSLog(@"[TypingInjector] Watching %@ for commands", cmdFile);
        NSDate *lastMod = [NSDate distantPast];

        while (1) {
            [NSThread sleepForTimeInterval:0.3]; // poll every 300ms

            NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:cmdFile error:nil];
            NSDate *mod = attrs[NSFileModificationDate];
            if (!mod || [mod isEqualToDate:lastMod]) continue;
            lastMod = mod;

            NSString *content = [NSString stringWithContentsOfFile:cmdFile encoding:NSUTF8StringEncoding error:nil];
            if (!content || content.length == 0) continue;

            // Clear the file immediately
            [@"" writeToFile:cmdFile atomically:YES encoding:NSUTF8StringEncoding error:nil];

            // Parse command
            NSArray *parts = [content componentsSeparatedByString:@":"];
            if (parts.count < 2) continue;

            NSString *cmd = [parts[0] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
            NSString *chatId = [[parts subarrayWithRange:NSMakeRange(1, parts.count-1)] componentsJoinedByString:@":"];
            chatId = [chatId stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

            dispatch_async(dispatch_get_main_queue(), ^{
                IMChat *chat = findChat(chatId);
                if (!chat) {
                    NSLog(@"[TypingInjector] Chat not found: %@", chatId);
                    // Write result
                    [@"error:chat_not_found" writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Messages/bit7_typing_result"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
                    return;
                }

                if ([cmd isEqualToString:@"start"]) {
                    [chat setLocalUserIsTyping:YES];
                    NSLog(@"[TypingInjector] Typing START for %@", chatId);
                    [@"ok:start" writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Messages/bit7_typing_result"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
                } else if ([cmd isEqualToString:@"stop"]) {
                    [chat setLocalUserIsTyping:NO];
                    NSLog(@"[TypingInjector] Typing STOP for %@", chatId);
                    [@"ok:stop" writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Messages/bit7_typing_result"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
                } else if ([cmd isEqualToString:@"chats"]) {
                    id registry = [NSClassFromString(@"IMChatRegistry") sharedInstance];
                    NSArray *chats = [registry allExistingChats];
                    NSMutableString *result = [NSMutableString stringWithFormat:@"ok:%lu chats\n", (unsigned long)chats.count];
                    for (IMChat *c in chats) {
                        [result appendFormat:@"%@\n", [c guid]];
                    }
                    [result writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Messages/bit7_typing_result"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
                }
            });
        }
    });
}

__attribute__((constructor))
static void injectorInit(void) {
    NSLog(@"[TypingInjector] Loaded inside Messages.app (PID %d)", getpid());
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        startTypingServer();
        startFileWatcher();
        NSLog(@"[TypingInjector] HTTP server on :5055 + file watcher active");
    });
}
