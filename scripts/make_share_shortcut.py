#!/usr/bin/env python3
"""
Generates the "Share to Bit7" shortcut.
Users install this → it appears in the iOS Share Sheet.
When they share a webpage/photo/text, it sends it to Bit7 via iMessage.

Run: python3 scripts/make_share_shortcut.py
Output: ~/Desktop/Share to Bit7.shortcut
"""
import plistlib, uuid, os

BIT7_PHONE = "+19496006007"  # Update with your Bit7 phone number

def u(): return str(uuid.uuid4()).upper()

INPUT_UID = u()
TEXT_UID = u()
PROMPT_UID = u()
MSG_UID = u()

shortcut = {
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 463140863,  # Blue
        "WFWorkflowIconGlyphNumber": 59761,  # Share icon
    },
    "WFWorkflowClientVersion": "2612.0.4",
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowTypes": ["ActionExtension"],  # Makes it appear in Share Sheet
    "WFWorkflowInputContentItemClasses": [
        "WFURLContentItem",
        "WFStringContentItem",
        "WFImageContentItem",
        "WFArticleContentItem",
        "WFSafariWebPageContentItem",
        "WFRichTextContentItem",
    ],
    "WFWorkflowActions": [
        # 1. Get the shared input as text
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "WFTextActionText": {
                    "Value": {
                        "attachmentsByRange": {
                            "{0, 1}": {
                                "OutputUUID": "ShortcutInput",
                                "Type": "ExtensionInput",
                                "Aggrandizements": [],
                            }
                        },
                        "string": "\ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "UUID": INPUT_UID,
            },
        },
        # 2. Ask what to do with it (optional prompt)
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "WFMenuItems": [
                    "Summarize this",
                    "What is this?",
                    "Save for later",
                    "Type my own message",
                ],
                "GroupingIdentifier": PROMPT_UID,
                "WFControlFlowMode": 0,  # Menu start
            },
        },
        # Option 1: Summarize
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": PROMPT_UID,
                "WFMenuItemTitle": "Summarize this",
                "WFControlFlowMode": 1,
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "WFTextActionText": {
                    "Value": {
                        "attachmentsByRange": {
                            "{21, 1}": {
                                "OutputUUID": INPUT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            }
                        },
                        "string": "Summarize this for me: \ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "UUID": MSG_UID,
            },
        },
        # Option 2: What is this?
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": PROMPT_UID,
                "WFMenuItemTitle": "What is this?",
                "WFControlFlowMode": 1,
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "WFTextActionText": {
                    "Value": {
                        "attachmentsByRange": {
                            "{16, 1}": {
                                "OutputUUID": INPUT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            }
                        },
                        "string": "What is this?\n\n\ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "UUID": MSG_UID + "-2",
            },
        },
        # Option 3: Save for later
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": PROMPT_UID,
                "WFMenuItemTitle": "Save for later",
                "WFControlFlowMode": 1,
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "WFTextActionText": {
                    "Value": {
                        "attachmentsByRange": {
                            "{26, 1}": {
                                "OutputUUID": INPUT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            }
                        },
                        "string": "Save this for me to remember: \ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "UUID": MSG_UID + "-3",
            },
        },
        # Option 4: Type own message
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": PROMPT_UID,
                "WFMenuItemTitle": "Type my own message",
                "WFControlFlowMode": 1,
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.ask",
            "WFWorkflowActionParameters": {
                "WFAskActionPrompt": "What do you want to ask Bit7 about this?",
                "WFAskActionDefaultAnswer": "",
                "UUID": TEXT_UID,
            },
        },
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
            "WFWorkflowActionParameters": {
                "WFTextActionText": {
                    "Value": {
                        "attachmentsByRange": {
                            "{0, 1}": {
                                "OutputUUID": TEXT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            },
                            "{3, 1}": {
                                "OutputUUID": INPUT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            },
                        },
                        "string": "\ufffc\n\n\ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "UUID": MSG_UID + "-4",
            },
        },
        # End menu
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": PROMPT_UID,
                "WFControlFlowMode": 2,  # Menu end
            },
        },
        # 3. Send via iMessage to Bit7
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.sendmessage",
            "WFWorkflowActionParameters": {
                "WFSendMessageActionRecipients": {
                    "Value": {
                        "string": BIT7_PHONE,
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
                "WFSendMessageContent": {
                    "Value": {
                        "attachmentsByRange": {
                            "{0, 1}": {
                                "OutputUUID": PROMPT_UID,
                                "Type": "ActionOutput",
                                "Aggrandizements": [],
                            }
                        },
                        "string": "\ufffc",
                    },
                    "WFSerializationType": "WFTextTokenString",
                },
            },
        },
    ],
}

out = os.path.expanduser("~/Desktop/Share to Bit7.shortcut")
with open(out, "wb") as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_BINARY)
print(f"✓ Share Sheet shortcut saved to {out}")
