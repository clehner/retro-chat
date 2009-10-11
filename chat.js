
var
	state,    // wave state
	viewerId, // id of the viewing participant
	participantsLoaded = false,

	messages = [],        // array of message objects
	messagesReceived = {}, // keys of received messages

	formEl,
	messagesEl,
	inputEl;

function sendMessage() {
	var msg, key, value, obj;
	
	msg = inputEl.value.replace(/^\s+/, '').replace(/\s+$/, ''); // trim
	if (msg) {
	
		// make a unique key with a timestamp and a rand
		key = +new Date + "." + (~~(Math.random() * 9000) + 1000);
		value = {
			from: viewerId,
			msg: msg
		};
		
		obj = {};
		obj[key] = JSON.stringify(value);
		wave.getState().submitDelta(obj);
		
		inputEl.value = "";
	}
	return false;
}
	
function insertMessage(msg) {
	var sender, name, msgEl, thumbEl, nameEl, i, l;
	
	// record receiving this message, so it is not re-rendered.
	messagesReceived[msg.key] = true;
	
	// build dom nodes for message
	if ("from" in msg) {
		sender = wave.getParticipantById(msg.from);
		name = sender ? ((msg.from === viewerId) ? "me" :
			sender.getDisplayName()) : msg.from;
	} else {
		name = "?";
	}

	msgEl = msg.div = document.createElement("div");
	msgEl.className = "message";
	msgEl.title = msg.time;
	
	/*thumbEl = document.createElement("img");
	thumbEl.src = sender ? sender.getThumbnailUrl() :
		"https://wave.google.com/wave/static/images/unknown.gif";
	msgEl.appendChild(thumbEl);*/
	
	nameEl = document.createElement("span");
	nameEl.appendChild(document.createTextNode(name + ":"));
	msgEl.appendChild(nameEl);
	
	msgEl.appendChild(document.createTextNode(msg.msg));

	// find the last message older than this one
	l = messages.length;
	i = l;
	while (i && (messages[i-1].time > msg.time)) {
		i--;
	}
	
	if (i == l) {
		// message is newer than all the rest; insert it at the end.
		messages[i] = msg;
		messagesEl.appendChild(msgEl);
		
	} else {
		// insert message in the middle at i
		messages.splice(i, msg, 0);
		messagesEl.insertBefore(msgEl, messages[i].div);
	}
}

function receiveMessages(msgs) {
	// sort incoming messages by time sent, in ascending order.
	msgs.sort(function (a, b) {
		return a.time - b.time;
	});
	
	var scrolledToBottom = (messagesEl.scrollTop + messagesEl.clientHeight ===
		messagesEl.scrollHeight);
	
	msgs.forEach(function (msg) {
		insertMessage(msg);
	});
	
	if (scrolledToBottom) {
		// keep it at the bottom
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}
}
	
function stateUpdated() {
	var keys, key, value, i, l, j, msgs, msg;
	
	if (!participantsLoaded) {
		// participants are not yet loaded.
		return false;
	}
	
	state = wave.getState();
	if (!state) {
		return;
	}
	keys = state.getKeys();
	l = keys.length;
	j = 0;
	msgs = Array(l);
	
	// for each state item
	for (i = 0; i < l; i++) {
		key = keys[i];
		value = state.get(key);
		if (value && !messagesReceived[key]) {
			// New message
			msg = JSON.parse(value);
			msg.key = key;
			msg.time = new Date(parseInt(key, 10));
			msgs[j++] = msg;
		}
	}
	
	receiveMessages(msgs);
}

function participantsUpdated() {
	if (!viewerId) {
		var viewer = wave.getViewer();
		if (viewer) {
			viewerId = viewer && viewer.getId();
			participantsLoaded = true;
			stateUpdated();
		}
	}
}

function gadgetLoad() {
	formEl = document.getElementById("container");
	messagesEl = document.getElementById("messages");
	inputEl = document.getElementById("input");
	
	// Wait for everything to be available
	if (!formEl) {
		return setTimeout(arguments.callee, 10);
	}
	
	formEl.onsubmit = sendMessage;

	// Set up wave callbacks
	if (wave && wave.isInWaveContainer()) {
		wave.setStateCallback(stateUpdated);
		wave.setParticipantCallback(participantsUpdated);
	}
	
	inputEl.focus();
}
gadgets.util.registerOnLoadHandler(gadgetLoad);
