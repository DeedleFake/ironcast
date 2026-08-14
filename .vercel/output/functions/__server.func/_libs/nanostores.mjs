//#region node_modules/nanostores/atom/index.js
var listenerQueue = [];
var lqIndex = 0;
var batchSeen = null;
var QUEUE_ITEMS_PER_LISTENER = 4;
var nanostoresGlobal = globalThis.nanostoresGlobal ||= { epoch: 0 };
var drainQueue = () => {
	for (lqIndex = 0; lqIndex < listenerQueue.length; lqIndex += QUEUE_ITEMS_PER_LISTENER) listenerQueue[lqIndex](listenerQueue[lqIndex + 1].value, listenerQueue[lqIndex + 2], listenerQueue[lqIndex + 3]);
	listenerQueue.length = 0;
};
var atom = /* @__NO_SIDE_EFFECTS__ */ (initialValue) => {
	let listeners = [];
	let $atom = {
		get() {
			if (!$atom.lc) $atom.listen(() => {})();
			return $atom.value;
		},
		init: initialValue,
		lc: 0,
		listen(listener) {
			$atom.lc = listeners.push(listener);
			return () => {
				for (let i = lqIndex + QUEUE_ITEMS_PER_LISTENER; i < listenerQueue.length;) if (listenerQueue[i] === listener) listenerQueue.splice(i, QUEUE_ITEMS_PER_LISTENER);
				else i += QUEUE_ITEMS_PER_LISTENER;
				let index = listeners.indexOf(listener);
				if (~index) {
					listeners.splice(index, 1);
					if (!--$atom.lc) $atom.off();
				}
			};
		},
		notify(oldValue, changedKey) {
			nanostoresGlobal.epoch++;
			let runListenerQueue = !listenerQueue.length && !batchSeen;
			for (let listener of listeners) {
				if (batchSeen?.has(listener)) continue;
				batchSeen?.add(listener);
				listenerQueue.push(listener, $atom, oldValue, batchSeen ? void 0 : changedKey);
			}
			if (runListenerQueue) drainQueue();
		},
		off() {},
		set(newValue) {
			let oldValue = $atom.value;
			if (oldValue !== newValue) {
				$atom.value = newValue;
				$atom.notify(oldValue);
			}
		},
		subscribe(listener) {
			let unbind = $atom.listen(listener);
			listener($atom.value);
			return unbind;
		},
		value: initialValue
	};
	return $atom;
};
//#endregion
//#region node_modules/nanostores/lifecycle/index.js
var SET = 2;
var MOUNT = 5;
var UNMOUNT = 6;
var REVERT_MUTATION = 10;
var on = (object, listener, eventKey, mutateStore) => {
	object.events = object.events || {};
	if (!object.events[eventKey + REVERT_MUTATION]) object.events[eventKey + REVERT_MUTATION] = mutateStore((eventProps) => {
		object.events[eventKey].reduceRight((event, l) => (l(event), event), {
			shared: {},
			...eventProps
		});
	});
	object.events[eventKey] = object.events[eventKey] || [];
	object.events[eventKey].push(listener);
	return () => {
		let currentListeners = object.events[eventKey];
		let index = currentListeners.indexOf(listener);
		currentListeners.splice(index, 1);
		if (!currentListeners.length) {
			delete object.events[eventKey];
			object.events[eventKey + REVERT_MUTATION]();
			delete object.events[eventKey + REVERT_MUTATION];
		}
	};
};
var onSet = ($store, listener) => on($store, listener, SET, (runListeners) => {
	let originSet = $store.set;
	let originSetKey = $store.setKey;
	if ($store.setKey) $store.setKey = (changed, changedValue) => {
		let isAborted;
		let abort = () => {
			isAborted = true;
		};
		runListeners({
			abort,
			changed,
			newValue: {
				...$store.value,
				[changed]: changedValue
			}
		});
		if (!isAborted) return originSetKey(changed, changedValue);
	};
	$store.set = (newValue) => {
		let isAborted;
		let abort = () => {
			isAborted = true;
		};
		runListeners({
			abort,
			newValue
		});
		if (!isAborted) return originSet(newValue);
	};
	return () => {
		$store.set = originSet;
		$store.setKey = originSetKey;
	};
});
var STORE_UNMOUNT_DELAY = 1e3;
var onMount = ($store, initialize) => {
	let listener = (payload) => {
		let destroy = initialize(payload);
		if (destroy) $store.events[UNMOUNT].push(destroy);
	};
	return on($store, listener, MOUNT, (runListeners) => {
		let originListen = $store.listen;
		$store.listen = (...args) => {
			if (!$store.lc && !$store.active) {
				$store.active = true;
				runListeners();
			}
			return originListen(...args);
		};
		let originOff = $store.off;
		$store.events[UNMOUNT] = [];
		$store.off = () => {
			originOff();
			setTimeout(() => {
				if ($store.active && !$store.lc) {
					$store.active = false;
					for (let destroy of $store.events[UNMOUNT]) destroy();
					$store.events[UNMOUNT] = [];
				}
			}, STORE_UNMOUNT_DELAY);
		};
		return () => {
			$store.listen = originListen;
			$store.off = originOff;
		};
	});
};
//#endregion
//#region node_modules/nanostores/listen-keys/index.js
function listenKeys($store, keys, listener) {
	let keysSet = new Set(keys);
	return $store.listen((value, oldValue, changed) => {
		if (changed === void 0 ? keys.some((key) => value[key] !== oldValue[key]) : keysSet.has(changed) || keysSet.has(changed.split(/\.|\[/)[0])) listener(value, oldValue, changed);
	});
}
//#endregion
export { atom as i, onMount as n, onSet as r, listenKeys as t };
