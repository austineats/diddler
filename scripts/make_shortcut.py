#!/usr/bin/env python3
"""
Generates the Bit7 Dispatcher.shortcut file with every useful action.
Run: python3 scripts/make_shortcut.py
Output: ~/Desktop/Bit7 Dispatcher.shortcut
"""
import plistlib, uuid, os

def u(): return str(uuid.uuid4()).upper()

# ── Core parse UUIDs ──────────────────────────────────────────
MESSAGES_UID  = u(); BODY_UID     = u(); SPLIT_UID    = u()
CMD_JSON_UID  = u(); CMD_DICT_UID = u(); ACTION_UID   = u(); PARAMS_UID = u()

# ── Conditional group UUIDs (one per action) ──────────────────
G = {a: u() for a in [
    "set_alarm", "play_music", "set_reminder", "set_timer",
    "set_volume", "set_brightness", "toggle_flashlight",
    "send_message", "make_call", "open_app", "open_url",
    "search_web", "get_battery", "play_pause", "next_track",
    "prev_track", "shazam", "create_note", "append_note",
    "take_photo", "save_photo", "set_wallpaper",
    "set_focus", "log_health", "get_health",
    "home_control", "send_email",
]}

def magic(uid):
    return {"Value": {"OutputUUID": uid, "Type": "ActionOutput", "Aggrandizements": []},
            "WFSerializationType": "WFTextTokenAttachment"}

def var(name):
    return {"Value": {"Type": "Variable", "VariableName": name},
            "WFSerializationType": "WFTextTokenAttachment"}

def txt(s):
    return {"Value": {"string": s, "attachmentsByRange": {}},
            "WFSerializationType": "WFTextTokenString"}

def get_key(uid, key, src):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
            "WFWorkflowActionParameters": {"UUID": uid, "WFDictionaryKey": txt(key), "WFInput": src}}

def set_var(name, src):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions.setvariable",
            "WFWorkflowActionParameters": {"WFVariableName": name, "WFInput": src}}

def if_eq(gid, match, src):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
            "WFWorkflowActionParameters": {
                "WFControlFlowMode": 0, "GroupingIdentifier": gid,
                "WFCondition": 4, "WFConditionalActionString": match, "WFInput": src}}

def end_if(gid):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
            "WFWorkflowActionParameters": {"WFControlFlowMode": 2, "GroupingIdentifier": gid}}

def action(identifier, params=None):
    return {"WFWorkflowActionIdentifier": identifier,
            "WFWorkflowActionParameters": params or {}}

# ── Helper: extract a param key, set as named var ─────────────
def extract(key, var_name=None):
    uid = u()
    name = var_name or key
    return [get_key(uid, key, var("params")), set_var(name, magic(uid))]

def flatten(lst):
    out = []
    for item in lst:
        if isinstance(item, list): out.extend(item)
        else: out.append(item)
    return out

actions = flatten([
    # ── 1. Get most recent message ───────────────────────────
    action("is.workflow.actions.getmessages", {"UUID": MESSAGES_UID, "WFGetMessagesCount": 1}),
    action("is.workflow.actions.properties.messages",
           {"UUID": BODY_UID, "WFContentItemPropertyName": "Body", "WFInput": magic(MESSAGES_UID)}),
    action("is.workflow.actions.text.split",
           {"UUID": SPLIT_UID, "WFTextSeparator": "Custom",
            "WFTextCustomSeparator": txt("BIT7_CMD:"), "text": magic(BODY_UID)}),
    action("is.workflow.actions.getitemfromlist",
           {"UUID": CMD_JSON_UID, "WFItemSpecifier": "Last Item", "WFInput": magic(SPLIT_UID)}),
    action("is.workflow.actions.detect.dictionary",
           {"UUID": CMD_DICT_UID, "WFInput": magic(CMD_JSON_UID)}),
    get_key(ACTION_UID, "action", magic(CMD_DICT_UID)),
    set_var("action", magic(ACTION_UID)),
    get_key(PARAMS_UID, "params", magic(CMD_DICT_UID)),
    set_var("params", magic(PARAMS_UID)),

    # ── set_alarm {time, label?} ─────────────────────────────
    if_eq(G["set_alarm"], "set_alarm", var("action")),
    extract("time", "alarmTime"), extract("label", "alarmLabel"),
    action("is.workflow.actions.setalarm",
           {"WFAlarmTime": var("alarmTime"), "WFAlarmLabel": var("alarmLabel"), "WFAlarmEnabled": True}),
    end_if(G["set_alarm"]),

    # ── set_timer {duration, label?} ─────────────────────────
    if_eq(G["set_timer"], "set_timer", var("action")),
    extract("duration", "timerDuration"),
    action("is.workflow.actions.timer.start", {"WFTimerDuration": var("timerDuration")}),
    end_if(G["set_timer"]),

    # ── play_music {query, service?} ─────────────────────────
    if_eq(G["play_music"], "play_music", var("action")),
    extract("query", "musicQuery"),
    action("is.workflow.actions.searchitunes",
           {"UUID": u(), "WFITunesMediaType": "Music",
            "WFSearchTerm": var("musicQuery"), "WFITunesItemLimit": 1}),
    action("is.workflow.actions.play", {}),
    end_if(G["play_music"]),

    # ── play_pause {} ────────────────────────────────────────
    if_eq(G["play_pause"], "play_pause", var("action")),
    action("is.workflow.actions.pausemusic", {}),
    end_if(G["play_pause"]),

    # ── next_track {} ────────────────────────────────────────
    if_eq(G["next_track"], "next_track", var("action")),
    action("is.workflow.actions.skipforward", {}),
    end_if(G["next_track"]),

    # ── prev_track {} ────────────────────────────────────────
    if_eq(G["prev_track"], "prev_track", var("action")),
    action("is.workflow.actions.skipback", {}),
    end_if(G["prev_track"]),

    # ── shazam {} ────────────────────────────────────────────
    if_eq(G["shazam"], "shazam", var("action")),
    action("is.workflow.actions.shazam", {}),
    end_if(G["shazam"]),

    # ── set_reminder {title, due_date?, due_time?} ───────────
    if_eq(G["set_reminder"], "set_reminder", var("action")),
    extract("title", "reminderTitle"),
    action("is.workflow.actions.addnewreminder", {"WFReminder": var("reminderTitle")}),
    end_if(G["set_reminder"]),

    # ── set_volume {level} (0–100) ───────────────────────────
    if_eq(G["set_volume"], "set_volume", var("action")),
    extract("level", "volumeLevel"),
    action("is.workflow.actions.setvolume", {"WFVolume": var("volumeLevel")}),
    end_if(G["set_volume"]),

    # ── set_brightness {level} (0–100) ───────────────────────
    if_eq(G["set_brightness"], "set_brightness", var("action")),
    extract("level", "brightnessLevel"),
    action("is.workflow.actions.setbrightness", {"WFBrightness": var("brightnessLevel")}),
    end_if(G["set_brightness"]),

    # ── toggle_flashlight {on: true|false} ───────────────────
    if_eq(G["toggle_flashlight"], "toggle_flashlight", var("action")),
    extract("on", "flashlightOn"),
    action("is.workflow.actions.flashlight", {"WFFlashlightSetting": var("flashlightOn")}),
    end_if(G["toggle_flashlight"]),

    # ── send_message {to, message} ───────────────────────────
    if_eq(G["send_message"], "send_message", var("action")),
    extract("to", "msgTo"), extract("message", "msgBody"),
    action("is.workflow.actions.sendmessage",
           {"WFSendMessageContent": var("msgBody"), "WFSendMessageRecipients": var("msgTo")}),
    end_if(G["send_message"]),

    # ── make_call {to} ───────────────────────────────────────
    if_eq(G["make_call"], "make_call", var("action")),
    extract("to", "callTo"),
    action("is.workflow.actions.call", {"WFCallContact": var("callTo")}),
    end_if(G["make_call"]),

    # ── send_email {to, subject, body} ───────────────────────
    if_eq(G["send_email"], "send_email", var("action")),
    extract("to", "emailTo"), extract("subject", "emailSubject"), extract("body", "emailBody"),
    action("is.workflow.actions.sendmail",
           {"WFSendEmailToRecipients": var("emailTo"),
            "WFSendEmailSubject": var("emailSubject"),
            "WFSendEmailBody": var("emailBody"),
            "WFSendEmailShowComposeSheet": False}),
    end_if(G["send_email"]),

    # ── open_app {name} ──────────────────────────────────────
    if_eq(G["open_app"], "open_app", var("action")),
    extract("name", "appName"),
    action("is.workflow.actions.openapp", {"WFAppIdentifier": var("appName")}),
    end_if(G["open_app"]),

    # ── open_url {url} ───────────────────────────────────────
    if_eq(G["open_url"], "open_url", var("action")),
    extract("url", "openUrl"),
    action("is.workflow.actions.openurl", {"WFInput": var("openUrl")}),
    end_if(G["open_url"]),

    # ── search_web {query, engine?} ──────────────────────────
    if_eq(G["search_web"], "search_web", var("action")),
    extract("query", "webQuery"),
    action("is.workflow.actions.searchwebwith",
           {"WFSearchWebDestination": "Google", "WFInputText": var("webQuery")}),
    end_if(G["search_web"]),

    # ── get_battery {} → sends result back via message ───────
    if_eq(G["get_battery"], "get_battery", var("action")),
    action("is.workflow.actions.getbatterylevel", {"UUID": u()}),
    end_if(G["get_battery"]),

    # ── take_photo {camera?: front|back} ─────────────────────
    if_eq(G["take_photo"], "take_photo", var("action")),
    extract("camera", "photoCamera"),
    action("is.workflow.actions.takephoto",
           {"WFCameraPosition": var("photoCamera"), "WFPhotoCount": 1,
            "WFShouldShowCamera": False}),
    end_if(G["take_photo"]),

    # ── create_note {title, body} ────────────────────────────
    if_eq(G["create_note"], "create_note", var("action")),
    extract("title", "noteTitle"), extract("body", "noteBody"),
    action("is.workflow.actions.shownote",
           {"WFNoteTitle": var("noteTitle"), "WFNoteContents": var("noteBody")}),
    end_if(G["create_note"]),

    # ── set_focus {mode} (DoNotDisturb, Sleep, Work, etc.) ───
    if_eq(G["set_focus"], "set_focus", var("action")),
    extract("mode", "focusMode"), extract("enabled", "focusEnabled"),
    action("is.workflow.actions.setfocus",
           {"WFFocusMode": var("focusMode"), "WFEnabled": var("focusEnabled")}),
    end_if(G["set_focus"]),

    # ── log_health {metric, value, unit?} ────────────────────
    if_eq(G["log_health"], "log_health", var("action")),
    extract("metric", "healthMetric"), extract("value", "healthValue"),
    action("is.workflow.actions.health.quantity.log",
           {"WFQuantityType": var("healthMetric"), "WFQuantity": var("healthValue")}),
    end_if(G["log_health"]),

    # ── get_health {metric, period} ──────────────────────────
    if_eq(G["get_health"], "get_health", var("action")),
    extract("metric", "healthMetric"), extract("period", "healthPeriod"),
    action("is.workflow.actions.health.quantity.find",
           {"WFQuantityType": var("healthMetric")}),
    end_if(G["get_health"]),

    # ── home_control {device, action, value?} ────────────────
    if_eq(G["home_control"], "home_control", var("action")),
    extract("device", "homeDevice"), extract("value", "homeValue"),
    action("is.workflow.actions.homekit.control",
           {"WFHomeAccessory": var("homeDevice"), "WFHomeSetting": var("homeValue")}),
    end_if(G["home_control"]),
])

shortcut = {
    "WFWorkflowClientVersion": "1140.1",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowName": "Bit7 Dispatcher",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 431817727, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": ["WFAppContentItem"],
    "WFWorkflowTypes": ["NCWidget", "WatchKit"],
    "WFWorkflowActions": actions
}

out = os.path.expanduser("~/Desktop/Bit7 Dispatcher.shortcut")
with open(out, "wb") as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_BINARY)
print(f"✓ {len(actions)} actions — saved to {out}")
