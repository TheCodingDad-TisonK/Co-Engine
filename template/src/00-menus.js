//@ the menus the editor saved: the start screen, the pause menu, the settings and their pages, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.
  CO.menus({
    "start": {
      "title": "A new game",
      "subtitle": "",
      "buttons": [
        {
          "label": "Play",
          "action": "play",
          "primary": true
        },
        {
          "label": "Settings",
          "action": "settings"
        },
        {
          "label": "How to play",
          "action": "guide"
        },
        {
          "label": "Save slots",
          "action": "slots"
        },
        {
          "label": "Quit",
          "action": "quit"
        }
      ]
    },
    "pause": {
      "title": "Paused",
      "buttons": [
        {
          "label": "Resume",
          "action": "resume",
          "primary": true
        },
        {
          "label": "Settings",
          "action": "settings"
        },
        {
          "label": "How to play",
          "action": "guide"
        },
        {
          "label": "Build mode",
          "action": "edit"
        },
        {
          "label": "Save file",
          "action": "saves"
        },
        {
          "label": "Main menu",
          "action": "quit"
        }
      ]
    },
    "settings": {
      "hide": [],
      "custom": []
    }
  });
