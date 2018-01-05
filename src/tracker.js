const EventEmitter = require('events');

const AFK = -1;
const DELETE = -5;
const MINUTE = 60000;
const TIMEOUT = MINUTE * 5;
const registry = {};
const pending = [];

let tID = 0;
let running = false;

/**
 * Looks up if key is tacked.
 * @param {string} key identifier
 * @returns True if key is tracked
 */
function has(key) {
  return registry.hasOwnProperty(key);
}

/**
 * Tracks key with the starting value.
 * 0 - Marks as "afk"
 * @param {string} key - identifier
 * @param {number|false} [value] - positive value (0+)
 */
function push(key, value) {
  if (value === null || value < 0) return;
  value = value || AFK;
  if (running) return pending.push({key, value});
  registry[key] = value;
}

/**
 * Remove key from tracker.
 * @param {string} key identifier
 */
function remove(key) {
  if (running) return pending.push({key, DELETE});
  delete registry[key];
}

function run() {
  running = true;
  const NOW = Date.now();
  tID = setTimeout(run, MINUTE - NOW % MINUTE);

  if (pending.length) {
    // Go through pending data
    pending.splice(0).forEach(({key, value} = data) => {
      if (value === DELETE) {
        delete registry[key];
      } else {
        registry[key] = value;
      }
    });
  }

  // Loop through registry - calling things that have timed out
  Object.keys(registry).forEach(key => {
    const val = registry[key];
    if (!val || val < 0 || val > NOW - TIMEOUT) return;
    // Only mark as AFK if listened to
    if (exports.emit('timeout', key, val)) {
      registry[key] = AFK;
    }
  });
  running = false;
}

/**
 * Starts tracker
 */
function start() {
  if (tID) return;
  run();
}

/**
 * Stops tracker
 */
function stop() {
  if (!tID) return;
  clearTimeout(tID);
  tID = 0;
}

/**
 * @returns True if tracker is active
 */
function isRunning() {
  return !!tID;
}

module.exports = exports = {
  has,
  push,
  remove,
  start,
  stop,
  isRunning,
};

EventEmitter.call(exports);
Object.assign(exports, EventEmitter.prototype);
