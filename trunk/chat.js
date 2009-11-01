/*
Retro Chat
A chat room Google Wave gadget.

Copyright (c) 2009 Charles Lehner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

var
	state,                 // Wave state
	viewerId,              // Id of the viewing participant
	participantsLoaded = false, // Has the first participant update been called
	chatParticipants = {}, // Participants that are marked in the wave state as
	                       // being in the chat.
	messages = [],         // Array of message objects
	messagesReceived = {}, // keys of recieved messages

	formEl,
	messagesEl,
	inputEl;


// send a message object
function sendMessage(msg) {
	
	// make a unique key with a timestamp and a rand
	var key = +new Date + "." + (~~(Math.random() * 9000) + 1000);

	var obj = {};
	obj[key] = JSON.stringify(msg);
	state.submitDelta(obj);
}

function sendChatMessage() {
	// trim the message
	var msg = inputEl.value.replace(/^\s+/, '').replace(/\s+$/, '');
	if (msg) {
		sendMessage({
			p: viewerId,
			msg: msg
		});
	}
	
	// reset the input box
	inputEl.value = "";
	return false;
}

function sendEntrance(pid) {
	// add the marker for the participant's presence in the chat
	var obj = {};
	obj["p_" + pid] = "1";
	state.submitDelta(obj);
	
	chatParticipants[pid] = true;
	
	// add a message for the participant's entrance.
	sendMessage({
		p: pid,
		enter: true
	});
}

function sendExit(pid) {
	// remove the participant from the state
	var obj = {};
	obj["p_" + pid] = null;
	state.submitDelta(obj);
	
	delete chatParticipants[pid];

	// add a message for their exit.
	sendMessage({
		p: pid,
		exit: true
	});
}

function renderMessageSender(msg) {
	var pid, sender, name, name2, text1, text2;
	
	pid = msg.p;
	if (pid !== undefined) {
		sender = wave.getParticipantById(pid);
		if (sender) {
			name = sender.getDisplayName();
		} else {
			name = pid;
		}
	} else {
		name = "?";
	}
	
	if (name == pid) {
		name2 = name;
	} else {
		name2 = name + " (" + pid + ")";
	}
	
	text2 = "";
	
	if (msg.msg) {
		text1 = name + ":";
		text2 = msg.msg;
	} else if (msg.enter) {
		text1 = name2 + " entered.";
	} else if (msg.exit) {
		text1 = name + " exited.";
	}
	
	msg.text1.nodeValue = text1;
	msg.text2.nodeValue = text2;
	msg.msgEl.title = name2 + " on " + msg.time.toLocaleString();
	msg.thumbEl.src = sender ? sender.getThumbnailUrl() :
		"https://wave.google.com/wave/static/images/unknown.gif";
}

function renderMessage(msg) {
	var msgEl, nameEl, text1, text2, i, l, prevMsg, timeEl, timeStr;
	
	// record receiving this message so it is not re-rendered.
	messagesReceived[msg.key] = true;
	
	// Build dom nodes for message
	msgEl = msg.msgEl = document.createElement("div");
	msgEl.className = "message";
	
	thumbEl = msg.thumbEl = document.createElement("img");
	msgEl.appendChild(thumbEl);
	
	msg.div = document.createElement("div");
	msg.div.appendChild(msgEl);
		
	nameEl = document.createElement("span");
	msgEl.appendChild(nameEl);
	
	msg.text1 = document.createTextNode("");
	nameEl.appendChild(msg.text1);
	
	msg.text2 = document.createTextNode("");
	msgEl.appendChild(msg.text2);

	if (msg.enter || msg.exit) {
		msgEl.className += " status";
	}
	
	renderMessageSender(msg);
	
	// If the message was sent before the participant, try to render it after
	// the participant's info is available.
	if (!wave.getParticipantById(msg.p)) {
		setTimeout(function () {
			renderMessageSender(msg);
		}, 10);
	}
	
	// find the last message older than this one
	l = messages.length;
	i = l;
	prevMsg = messages[i-1];
	while (i && (prevMsg.time > msg.time)) {
		i--;
		prevMsg = messages[i];
	}
	
	if (i == l) {
		// message is newer than all the rest; insert it at the end.
		messages[i] = msg;
		messagesEl.appendChild(msg.div);
		
	} else {
		// insert message in the middle of the page, before message i
		messages.splice(i, msg, 0);
		messagesEl.insertBefore(msg.div, messages[i].div);
	}
	
	// timestamp if more than 5 minutes passed since the last message.
	updateTime = (!prevMsg || (msg.time - prevMsg.time > 5*60*1000));
	// datestamp if it is a different day than the last message.
	updateDate = (!prevMsg || (msg.time.toDateString() != prevMsg.time.toDateString()));
	
	if (updateTime) {
		if (updateDate) {
			// both date and time stamp
			timeStr = msg.time.toLocaleString();
		} else {
			timeStr = msg.time.toLocaleTimeString();
		}
		timeEl = document.createElement("div");
		timeEl.className = "time status message";
		timeEl.appendChild(document.createTextNode(timeStr));
		msg.div.insertBefore(timeEl, msgEl);

	} else if (updateDate) {
		timeStr = msg.time.toLocaleDateString();
		timeEl = document.createElement("div");
		timeEl.className = "date status message";
		timeEl.appendChild(document.createTextNode(timeStr));
		msg.div.insertBefore(timeEl, msgEl);
	}
}

function receiveMessages(msgs) {
	// sort incoming messages by time sent, in ascending order.
	msgs.sort(function (a, b) {
		return a.time - b.time;
	});
	
	var isScrolledToBottom = (messagesEl.scrollTop + messagesEl.clientHeight ===
		messagesEl.scrollHeight);
	
	msgs.forEach(function (msg) {
		renderMessage(msg);
	});
	
	if (isScrolledToBottom) {
		// then keep it at the bottom
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}
}
	
function stateUpdated() {
	var keys, key, value, i, l, j, msgs, msg, pid;
	
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
	
	// for each state item:
	for (i = 0; i < l; i++) {
		key = keys[i];
		value = state.get(key);
		
		if (!value) continue;
		
		if (!messagesReceived[key] && !isNaN(key)) {
			// New message
			msg = JSON.parse(value);
			msg.key = key;
			msg.time = new Date(parseInt(key, 10));
			msgs[j++] = msg;
			
		} else if (key.indexOf("p_") === 0) {
			// A participant is in the chat.
			pid = key.substr(2);
			chatParticipants[pid] = true;
		}
	}
	
	receiveMessages(msgs);
}

function participantsUpdated() {
	if (!viewerId) {
		var viewer = wave.getViewer();
		if (viewer) {
			// First participant update.
			viewerId = viewer && viewer.getId();
			participantsLoaded = true;
			stateUpdated();
		}

		// Announce our entrance
		if (!chatParticipants[viewerId]) {
			sendEntrance(viewerId);
		}
	}
	
	// delay to give time for new participants to announce themselves
	setTimeout(function () {
	
		// Look for new participants.
		wave.getParticipants().forEach(function (participant) {
			var pid = participant.getId();
			// Each wave participant should be marked as being in the chat
			// by the state key "p_" + their id.
			
			// If a participant is new and doesn't have this mark,
			if (!chatParticipants[pid]) {
			
				// notify everyone of their entrance.
				sendEntrance(pid);
			}
		});
		
		// Look for gone participants.
		for (var pid in chatParticipants) {
			// If a participant has left, or is marked in the state but
			// is no longer a participant,
			if (!wave.getParticipantById(pid)) {
			
				// notify everyone of their exit
				sendExit(pid);
			}
		}
		
	}, 3000);
}

function gadgetLoad() {
	formEl = document.getElementById("container");
	messagesEl = document.getElementById("messages");
	inputEl = document.getElementById("input");
	
	// Wait for everything to be available
	if (!formEl) {
		return setTimeout(arguments.callee, 10);
	}
	
	formEl.onsubmit = sendChatMessage;

	// Set up wave callbacks
	if (wave && wave.isInWaveContainer()) {
		wave.setStateCallback(stateUpdated);
		wave.setParticipantCallback(participantsUpdated);
	}
	
	inputEl.focus();
}
gadgets.util.registerOnLoadHandler(gadgetLoad);
