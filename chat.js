/*
Retro Chat
A Chat Room Google Wave gadget.

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

/*global window, gadgets, document, wave, setTimeout */

var
	state,                 // Wave state
	viewerId,              // Id of the viewing participant
	viewerHasEntered = false,
	participantsLoaded = false, // Has the first participant update been called
	chatParticipants = {}, // Participants that are marked in the wave state as
	                       // being in the chat.
	resizing = false,
	messages = [],         // Array of message objects
	messagesByKey = {},

	formEl,
	messagesEl,
	inputEl,
	resizerEl;
// send a message object, and optionally, other stuff
function sendMessage(msg, delta) {
	if (!delta) {
		delta = {};
	}
	// make a unique key with a timestamp and a rand
	var key = +new Date() + "." + ~~(Math.random() * 9999);
	delta[key] = JSON.stringify(msg);
	state.submitDelta(delta);
}

// Send a chat or status message, JSON encoded, into the state.
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

function sendEntrance() {
	if (viewerHasEntered) {
		return;
	}
	
	// add a marker for the viewer's presence in the chat
	var delta = {};
	delta["p_" + viewerId] = "1";
	
	chatParticipants[viewerId] = true;
	viewerHasEntered = true;
	
	// add a message for the participant's entrance.
	sendMessage({
		p: viewerId,
		enter: true
	}, delta);
}

function sendExit(pid) {
	// remove the participant from the state
	state.submitValue("p_" + pid, null);
	
	delete chatParticipants[pid];

	// add a message for their exit.
	sendMessage({
		p: pid,
		exit: true
	});
}

function Message(time, data) {
	this.time = time;
	this.text = data.msg;
	this.pid = data.p;
	this.isEntrance = data.enter;
	this.isExit = data.exit;
}
Message.prototype.getSender = function () {
	return wave.getParticipantById(this.pid);
};
Message.prototype.render = function render(data) {
	var self = this;
	var future = this.time - new Date();
	if (future > 0) {
		// a message from the future!
		if (future < 1e12) {
			// near future
			setTimeout(function () {
				self.renderMessage();
			}, future);
		}
		return;
	}
	
	// Build dom nodes for message
	var msgEl = this.msgEl = document.createElement("div");
	msgEl.className = "message";
	
	var thumbEl = this.thumbEl = document.createElement("img");
	msgEl.appendChild(thumbEl);
	
	this.div = document.createElement("div");
	this.div.appendChild(msgEl);
		
	var nameEl = document.createElement("span");
	msgEl.appendChild(nameEl);
	
	this.text1 = document.createTextNode("");
	nameEl.appendChild(this.text1);
	
	this.text2 = document.createTextNode("");
	msgEl.appendChild(this.text2);

	if (this.isEntrance || this.isExit) {
		msgEl.className += " status";
	}
	
	this.renderSender();
	
	// find the last message older than this one
	var l = messages.length;
	var i = l;
	var prevMsg = messages[i-1];
	while (i && (prevMsg.time > this.time)) {
		i--;
		prevMsg = messages[i];
	}
	
	if (i == l) {
		// message is newer than all the rest; insert it at the end.
		messages[i] = this;
		messagesEl.appendChild(this.div);
		
	} else {
		// insert message in the middle of the page, before message i
		messages.splice(i, this, 0);
		messagesEl.insertBefore(this.div, messages[i].div); // prevMsg?
	}
	
	// timestamp if more than 5 minutes passed since the last message.
	var updateTime = (!prevMsg || (this.time - prevMsg.time > 5*60*1000));
	// datestamp if it is a different day than the last message.
	var updateDate = (!prevMsg || (this.time.toDateString() != prevMsg.time.toDateString()));
	
	var timeStr, timeEl;
		
	if (updateTime) {
		if (updateDate) {
			// both date and time stamp
			timeStr = this.time.toLocaleString();
		} else {
			timeStr = this.time.toLocaleTimeString();
		}
		timeEl = document.createElement("div");
		timeEl.className = "time status message";
		timeEl.appendChild(document.createTextNode(timeStr));
		this.div.insertBefore(timeEl, msgEl);

	} else if (updateDate) {
		timeStr = this.time.toLocaleDateString();
		timeEl = document.createElement("div");
		timeEl.className = "date status message";
		timeEl.appendChild(document.createTextNode(timeStr));
		this.div.insertBefore(timeEl, msgEl);
	}
};
Message.prototype.renderSender = function (msg) {
	var name, sender;
	if (this.pid) {
		sender = this.getSender();
		// If the message was sent before the participant, try to render
		// it after the participant's info is available.
		if (!sender) {
			var self = this;
			setTimeout(function () {
				self.renderSender();
			}, 10);
			return;
		}
		name = sender ? sender.getDisplayName() : this.pid;
	} else {
		name = "?";
	}

	var name2 = (name == this.pid) ? name : name + " (" + this.pid + ")";

	var text1;
	var text2 = "";
	
	if (this.text) {
		text1 = name + ":";
		text2 = this.text;
	} else if (this.isEntrance) {
		text1 = name2 + " entered.";
	} else if (this.isExit) {
		text1 = name + " exited.";
	}
	
	this.text1.nodeValue = text1;
	this.text2.nodeValue = text2;
	this.msgEl.title = name2 + " on " + this.time.toLocaleString();
	this.thumbEl.src = sender ? sender.getThumbnailUrl() :
		"//celehner.com/gadgets/participant.jpg";
};
Message.prototype.remove = function () {
	if (this.div.parentNode == messagesEl) {
		messagesEl.removeChild(this.div);
	}
	var i = messages.indexOf(this);
	if (i != -1) {
		messages.splice(i, 1);
	}
};


function keepScroll(fn) {
	var isScrolledToBottom = (messagesEl.scrollHeight ===
		messagesEl.scrollTop + messagesEl.clientHeight);
	fn();
	if (isScrolledToBottom) {
		// then keep it at the bottom
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}
}


function receiveMessages(msgs) {
	// sort incoming messages by time sent, in ascending order.
	msgs.sort(function (a, b) {
		return a.time - b.time;
	});
	keepScroll(function () {
		msgs.forEach(function (msg) {
			msg.render();
		});
	});
}

/* Resizer */

function renderHeight(height) {
	height = Math.max(height, 30);
	keepScroll(function () {
		formEl.style.height = height + "px";
		gadgets.window.adjustHeight(+height + 2); // plus 2 for border
	});
}

function onResizerMouseDown(e) {
	if (resizing) {
		return false;
	}
	resizing = true;
	var startY = formEl.clientHeight - e.clientY;
	function onMouseMove(e) {
		var height = startY + e.clientY;
		renderHeight(height);
	}
	function onMouseUp(e) {
		resizing = false;
		window.removeEventListener("mousemove", onMouseMove, false);
		window.removeEventListener("mouseup", onMouseUp, false);
		var height = startY + e.clientY;
		state.submitValue("height", height);
	}
	window.addEventListener("mousemove", onMouseMove, false);
	window.addEventListener("mouseup", onMouseUp, false);
}

/* State stuff */

function receiveStateDelta(delta) {
	var newMessages = [];
	var i = 0;
	for (var key in delta) {
		var value = delta[key];
		if (!isNaN(key)) {
			// it is a message.
			var msg = messagesByKey[key];
			if (msg) {
				// remove previous message
				msg.remove(msg);
				delete messagesByKey[key];
			}
			if (value) {
				// add new message.
				var time = new Date(parseInt(key, 10));
				msg = new Message(time, JSON.parse(value));
				messagesByKey[key] = msg;
				newMessages[i++] = msg;
			}
		} else if (key.indexOf("p_") === 0) {
			// A participant has entered or left the chat.
			var pid = key.substr(2);
			if (value) {
				chatParticipants[pid] = true;
			} else {
				delete chatParticipants[pid];
			}
			if (pid == viewerId) {
				viewerHasEntered = chatParticipants[pid];
			}
		} else if (key == "height") {
			renderHeight(value);
		}
	}
	if (i) {
		receiveMessages(newMessages);
	}
}

var rawState = {};
function stateUpdated() {
	state = wave.getState();
	if (!participantsLoaded) {
		// participants are not yet loaded.
		return;
	}
	if (!state || !state.state_) {
		return;
	}
	var newState = state.state_;
	var delta = {};
	for (var key in rawState) {
		if (!(key in newState)) {
			delta[key] = null;
			delete rawState[key];
		}
	}
	for (key in newState) {
		if (newState[key] !== rawState[key]) {
			var value = newState[key];
			delta[key] = value;
			rawState[key] = value;
		}
	}
	receiveStateDelta(delta);
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
	}

	// Look for gone participants.
	for (var pid in chatParticipants) {
		// We infer that a participant has exited if its presence is marked
		// in the state but is not in the participants list.
		if (!wave.getParticipantById(pid)) {
		
			// notify everyone of their exit
			sendExit(pid);
		}
	}
}

function modeChanged(mode) {
	var className =
		mode == wave.Mode.VIEW ? "view-mode" :
		mode == wave.Mode.EDIT ? "edit-mode" :
		mode == wave.Mode.PLAYBACK ? "playback-mode" : "";
	keepScroll(function () {
		formEl.className = className;
	});
}

function gadgetLoad() {
	formEl = document.getElementById("container");
	messagesEl = document.getElementById("messages");
	inputEl = document.getElementById("input");
	resizerEl = document.getElementById("resizer");
	
	// Wait for everything to be available
	if (!formEl) {
		return setTimeout(gadgetLoad, 10);
	}
	
	inputEl.onkeypress = sendEntrance;
	formEl.onsubmit = sendChatMessage;
	resizerEl.onmousedown = onResizerMouseDown;

	// Set up wave callbacks
	if (wave && wave.isInWaveContainer()) {
		wave.setStateCallback(stateUpdated);
		wave.setParticipantCallback(participantsUpdated);
		wave.setModeCallback(modeChanged);
	}
	
	inputEl.focus();
}
gadgets.util.registerOnLoadHandler(gadgetLoad);
