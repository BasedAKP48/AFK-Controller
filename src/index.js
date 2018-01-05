const admin = require('firebase-admin');
const pkg = require('../package.json');
const serviceAccount = require("../serviceAccount.json");
const tracker = require('./tracker');
const utils = require('@basedakp48/plugin-utils');

utils.initialize(admin, serviceAccount);

const rootRef = admin.database().ref();
const registry = rootRef.child('pluginRegistry');
const presence = utils.PresenceSystem();

presence.on('connect', () => console.log('Connected'));
presence.on('disconnect', () => console.log('Disconnected'));
presence.on('message', processMessage);
registry.on('child_added', processEntry);
tracker.on('timeout', setAfk);

presence.initialize({rootRef, pkg});
tracker.start();

// location: registry/CID
function processEntry(entry) {
  // Register key, if listenMode === connector
  if (entry.val().info.listenMode !== 'connector') return;
  const cid = entry.key;

  let initial = {};
  const fn_connected = entry.ref.child('presence/connected').on('value', (c) => {
    // If connected, add to our tracker
    if (c.val()) {
      // Add to registry
      // TODO: "lastMessageSent" -> Depends on stats
      entry.ref.child('presence/status').once('value', (s) => {
        tracker.push(cid, s.val() === 'afk' ? 0 : Date.now());
      });
    } else if (tracker.has(cid)) {
      // Remove from registry
      tracker.remove(cid);
    }
  });

  // Was this registry deleted? If so, turn off all listeners
  const fn_self = entry.ref.on('value', (e) => {
    if (e.val() !== null) return;

    e.ref.off('value', fn_self);
    e.ref.child('presence/connected').off('value', fn_connected);
  });
}

function processMessage(msg) {
  if (msg.direction !== 'out' || !tracker.has(msg.cid)) return;

  // Set online
  registry.child(msg.cid).child('presence/status').once('value', e => e.val() === 'afk' && e.ref.set('online'));

  // Mark time this message went out
  tracker.push(msg.cid, msg.timeReceived);
}

function setAfk(key) {
  // Only change status if it doesn't exist, or is online
  registry.child(key).child('presence/status').once('value', (s) => {
    if (!s.val() || s.val() === 'online') s.ref.set('afk');
  });
}
