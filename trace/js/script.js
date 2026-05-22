const body = document.body;

const canvas = document.getElementById("canvas");
const emptyState = document.getElementById("emptyState");
const photoInput = document.getElementById("photoInput");
const photo = document.getElementById("photo");
const imageBox = document.getElementById("imageBox");
const pointLayer = document.getElementById("pointLayer");
const tracePath = document.getElementById("tracePath");

const addPointBtn = document.getElementById("addPointBtn");
const finishBtn = document.getElementById("finishBtn");
const editBtn = document.getElementById("editBtn");
const placementPill = document.getElementById("placementPill");
const peekHelp = document.getElementById("peekHelp");

const modal = document.getElementById("memoryModal");
const closeModalBtn = document.getElementById("closeModal");
const memoryDescription = document.getElementById("memoryDescription");
const wordCounter = document.getElementById("wordCounter");
const saveMemoryBtn = document.getElementById("saveMemoryBtn");

const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const previewBtn = document.getElementById("previewBtn");
const deleteRecordingBtn = document.getElementById("deleteRecordingBtn");
const recordStatus = document.getElementById("recordStatus");
const audioPlayer = document.getElementById("audioPlayer");

const memoryCard = document.getElementById("memoryCard");
const memoryTitle = document.getElementById("memoryTitle");
const memoryText = document.getElementById("memoryText");
const voiceTimer = document.getElementById("voiceTimer");

let state = "empty";
let memories = [];
let pendingPoint = null;
const MAX_TRACE_WORDS = 6;

let mediaRecorder = null;
let recordedChunks = [];
let pendingAudioUrl = "";
let timerInterval = null;
let timerStarted = 0;
let activePoint = null;
let holdTimer = null;
let armingPoint = null;
let recordingTimer = null;
let recordingStartedAt = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startRecordingTimer() {
  stopRecordingTimer();
  recordingStartedAt = Date.now();
  recordStatus.textContent = "Recording 0:00";
  recordingTimer = window.setInterval(() => {
    const elapsed = (Date.now() - recordingStartedAt) / 1000;
    recordStatus.textContent = `Recording ${formatTime(elapsed)}`;
  }, 250);
}

function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
}

function getTraceWords(value) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function enforceTraceWordLimit() {
  const words = getTraceWords(memoryDescription.value);

  if (words.length > MAX_TRACE_WORDS) {
    memoryDescription.value = words.slice(0, MAX_TRACE_WORDS).join(" ");
  }

  updateTraceWordCounter();
}

function updateTraceWordCounter() {
  if (!wordCounter) return;
  const count = getTraceWords(memoryDescription.value).length;
  wordCounter.textContent = String(Math.min(count, MAX_TRACE_WORDS));
}

function setState(next) {
  state = next;
  body.classList.toggle("editor-mode", state === "editor" || state === "placing");
  body.classList.toggle("viewer-mode", state === "viewer");
  body.classList.toggle("has-photo", state !== "empty");

  emptyState.classList.toggle("is-hidden", state !== "empty");
  imageBox.classList.toggle("is-hidden", state === "empty");

  addPointBtn.classList.toggle("is-hidden", state !== "editor");
  finishBtn.classList.toggle("is-hidden", state !== "editor");
  editBtn.classList.toggle("is-hidden", state !== "viewer");
  placementPill.classList.toggle("is-hidden", state !== "placing");
  peekHelp.classList.toggle("is-hidden", state !== "viewer" || memories.length === 0);

  if (state !== "viewer") body.classList.remove("peek-traces");

  renderMemories();
}

function fitImageBox() {
  if (!photo.naturalWidth || !photo.naturalHeight) return;

  const canvasRect = canvas.getBoundingClientRect();
  const maxW = canvasRect.width - 28;
  const maxH = canvasRect.height - 44;
  const ratio = photo.naturalWidth / photo.naturalHeight;

  let width = maxW;
  let height = width / ratio;

  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }

  imageBox.style.width = `${Math.max(170, width)}px`;
  imageBox.style.height = `${Math.max(170, height)}px`;
}

window.addEventListener("resize", fitImageBox);
window.addEventListener("orientationchange", () => setTimeout(fitImageBox, 250));

function openPhotoPickerFromEmptyArea(event) {
  if (state !== "empty") return;
  if (event.target.closest("button, input, label")) return;
  photoInput.click();
}

canvas.addEventListener("click", openPhotoPickerFromEmptyArea);
emptyState.addEventListener("click", (event) => {
  if (state !== "empty") return;
  event.stopPropagation();
  photoInput.click();
});

photoInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  photo.onload = () => {
    fitImageBox();
    memories = [];
    setState("editor");
  };
  photo.src = url;
});

addPointBtn.addEventListener("click", () => {
  if (state !== "editor") return;
  setState("placing");
});

finishBtn.addEventListener("click", () => {
  if (memories.length === 0) {
    setState("placing");
    return;
  }
  setState("viewer");
});

editBtn.addEventListener("click", () => {
  hideMemory();
  setState("editor");
});

imageBox.addEventListener("pointerdown", event => {
  if (event.target.closest(".trace-point")) return;

  const rect = imageBox.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  if (state === "viewer") {
    const nearest = findNearestMemory(x, y);
    if (!nearest) return;

    event.preventDefault();
    imageBox.setPointerCapture(event.pointerId);
    const pointEl = pointLayer.querySelector(`[data-memory-id="${nearest.id}"]`);
    if (pointEl) startHoldReveal(nearest, pointEl);
    return;
  }

  if (state !== "placing") return;

  pendingPoint = {
    x: clamp(x, 3, 97),
    y: clamp(y, 3, 97)
  };

  openModal();
});

imageBox.addEventListener("pointerup", () => {
  if (state === "viewer") stopHoldReveal();
});

imageBox.addEventListener("pointercancel", () => {
  if (state === "viewer") stopHoldReveal();
});

imageBox.addEventListener("lostpointercapture", () => {
  if (state === "viewer") stopHoldReveal();
});

function openModal() {
  memoryDescription.value = "";
  pendingAudioUrl = "";
  updateTraceWordCounter();
  resetRecorderUi();
  modal.classList.remove("is-hidden");
}

function closeModal() {
  modal.classList.add("is-hidden");
  pendingPoint = null;
  setState("editor");
}

closeModalBtn.addEventListener("click", closeModal);
memoryDescription.addEventListener("input", enforceTraceWordLimit);

saveMemoryBtn.addEventListener("click", () => {
  if (!pendingPoint) return;

  memories.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    x: pendingPoint.x,
    y: pendingPoint.y,
    type: "voice",
    text: getTraceWords(memoryDescription.value).slice(0, MAX_TRACE_WORDS).join(" "),
    audioUrl: pendingAudioUrl
  });

  pendingPoint = null;
  modal.classList.add("is-hidden");
  setState("editor");
});

function renderMemories() {
  pointLayer.innerHTML = "";

  memories.forEach(memory => {
    const point = document.createElement("button");
    point.className = "trace-point";
    point.type = "button";
    point.style.left = `${memory.x}%`;
    point.style.top = `${memory.y}%`;
    point.dataset.memoryId = memory.id;
    point.setAttribute("aria-label", "Hold to reveal memory");

    point.addEventListener("pointerdown", event => {
      if (state !== "viewer") return;
      event.preventDefault();
      event.stopPropagation();
      point.setPointerCapture(event.pointerId);
      startHoldReveal(memory, point);
    });

    point.addEventListener("pointerup", () => stopHoldReveal());
    point.addEventListener("pointercancel", () => stopHoldReveal());
    point.addEventListener("lostpointercapture", () => stopHoldReveal());
    point.addEventListener("contextmenu", event => event.preventDefault());

    pointLayer.appendChild(point);
  });

  updateTrace();
}

function updateTrace() {
  tracePath.setAttribute("d", "");
}

function findNearestMemory(x, y) {
  if (!memories.length) return null;

  let nearest = null;
  let nearestDistance = Infinity;

  memories.forEach(memory => {
    const dx = memory.x - x;
    const dy = memory.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < nearestDistance) {
      nearest = memory;
      nearestDistance = distance;
    }
  });

  // The area is intentionally forgiving because a finger covers the exact dot.
  return nearestDistance <= 12 ? nearest : null;
}

function titleForType(type) {
  return "voice memory";
}

function startHoldReveal(memory, pointEl) {
  stopHoldReveal(false);

  armingPoint = pointEl;
  armingPoint.classList.add("is-arming");
  body.classList.add("peek-traces");
  body.classList.remove("searching-traces");

  holdTimer = window.setTimeout(() => {
    holdTimer = null;
    if (armingPoint) {
      armingPoint.classList.remove("is-arming");
    }
    showMemory(memory, pointEl);
  }, 420);
}

function stopHoldReveal(shouldHide = true) {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  if (armingPoint) {
    armingPoint.classList.remove("is-arming");
    armingPoint = null;
  }

  if (shouldHide) {
    hideMemory();
  }
}

function showMemory(memory, pointEl) {
  activePoint = pointEl;
  activePoint.classList.add("is-held");
  body.classList.add("peek-traces");
  body.classList.add("point-listening");
  body.classList.remove("searching-traces");

  memoryTitle.textContent = titleForType(memory.type);
  memoryText.textContent = memory.text || "Hold to listen.";

  const boxRect = imageBox.getBoundingClientRect();
  const cardWidth = Math.min(200, window.innerWidth * 0.64);
  const cardHeight = 112;
  const xPx = (memory.x / 100) * boxRect.width;
  const yPx = (memory.y / 100) * boxRect.height;

  // Keep the popup close to the point, slightly offset so it does not sit directly under the finger.
  let left = xPx - Math.min(46, cardWidth * 0.26);

  // If the point is near the center, nudge the card slightly left or right instead of centering it awkwardly.
  if (memory.x >= 42 && memory.x <= 58) {
    left += memory.x < 50 ? -18 : 18;
  }

  left = clamp(left, 6, boxRect.width - cardWidth - 6);

  // Prefer placing the card above the point. If there is not enough room, place it below.
  let top = yPx - cardHeight - 14;
  if (top < 6) {
    top = yPx + 16;
  }

  // Final clamp keeps it inside the photo area and away from extreme centre jumps.
  top = clamp(top, 6, boxRect.height - cardHeight - 6);

  memoryCard.classList.remove("outside-photo");
  memoryCard.style.left = `${left}px`;
  memoryCard.style.top = `${top}px`;
  memoryCard.classList.remove("is-hidden");

  if (memory.audioUrl) {
    playAudio(memory.audioUrl);
  } else {
    voiceTimer.textContent = "no voice";
  }
}

function hideMemory() {
  if (activePoint) activePoint.classList.remove("is-held");
  if (armingPoint) armingPoint.classList.remove("is-arming");
  activePoint = null;
  armingPoint = null;
  memoryCard.classList.add("is-hidden");
  memoryCard.classList.remove("outside-photo");
  stopPlayback();
  body.classList.remove("point-listening");
  body.classList.remove("searching-traces");
  if (state === "viewer") body.classList.remove("peek-traces");
}

canvas.addEventListener("pointerdown", event => {
  if (state !== "viewer" || memories.length === 0) return;
  if (event.target.closest(".image-box")) return;

  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  body.classList.add("peek-traces");
  body.classList.add("searching-traces");
});

canvas.addEventListener("pointerup", () => {
  body.classList.remove("searching-traces");
  if (!activePoint) body.classList.remove("peek-traces");
});

canvas.addEventListener("pointercancel", () => {
  body.classList.remove("searching-traces");
  if (!activePoint) body.classList.remove("peek-traces");
});

canvas.addEventListener("lostpointercapture", () => {
  body.classList.remove("searching-traces");
  if (!activePoint) body.classList.remove("peek-traces");
});

function playAudio(url) {
  stopPlayback();
  audioPlayer.src = url;
  audioPlayer.currentTime = 0;
  voiceTimer.textContent = "0:00";

  audioPlayer.onloadedmetadata = () => {
    if (Number.isFinite(audioPlayer.duration)) {
      voiceTimer.textContent = `0:00 / ${formatTime(audioPlayer.duration)}`;
    }
  };

  audioPlayer.ontimeupdate = () => {
    const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
    voiceTimer.textContent = duration
      ? `${formatTime(audioPlayer.currentTime)} / ${formatTime(duration)}`
      : formatTime(audioPlayer.currentTime);
  };

  audioPlayer.onended = () => {
    const duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : audioPlayer.currentTime;
    voiceTimer.textContent = formatTime(duration);
  };

  audioPlayer.play().catch(() => {
    voiceTimer.textContent = "tap again";
  });
}

function stopPlayback() {
  audioPlayer.pause();
  audioPlayer.onloadedmetadata = null;
  audioPlayer.ontimeupdate = null;
  audioPlayer.onended = null;
  audioPlayer.removeAttribute("src");
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  voiceTimer.textContent = "hold to listen";
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    recordStatus.textContent = "Recording is not supported in this browser.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      stopRecordingTimer();
      const recordedSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      pendingAudioUrl = URL.createObjectURL(blob);
      stream.getTracks().forEach(track => track.stop());

      recordStatus.textContent = `Voice note recorded (${formatTime(recordedSeconds)}).`;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      previewBtn.disabled = false;
      deleteRecordingBtn?.classList.remove("is-hidden");
    };

    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    previewBtn.disabled = true;
    deleteRecordingBtn?.classList.add("is-hidden");
    startRecordingTimer();
  } catch (error) {
    recordStatus.textContent = "Microphone permission was blocked.";
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  stopRecordingTimer();
}

function previewRecording() {
  if (!pendingAudioUrl) return;
  stopPlayback();
  audioPlayer.src = pendingAudioUrl;
  audioPlayer.currentTime = 0;
  audioPlayer.play().catch(() => {
    recordStatus.textContent = "Could not preview audio.";
  });
}

function resetRecorderUi() {
  stopRecordingTimer();
  recordBtn.disabled = false;
  stopBtn.disabled = true;
  previewBtn.disabled = true;
  deleteRecordingBtn?.classList.add("is-hidden");
  recordStatus.textContent = "No voice note yet.";
}

function deletePendingRecording() {
  stopPlayback();
  stopRecordingTimer();
  pendingAudioUrl = "";
  recordBtn.disabled = false;
  stopBtn.disabled = true;
  previewBtn.disabled = true;
  deleteRecordingBtn?.classList.add("is-hidden");
  recordStatus.textContent = "Voice note deleted.";
}

recordBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
previewBtn.addEventListener("click", previewRecording);
deleteRecordingBtn?.addEventListener("click", deletePendingRecording);


function allowNativeTextInteraction(event) {
  return Boolean(event.target.closest("textarea, input"));
}

function blockAccidentalSelection(event) {
  if (allowNativeTextInteraction(event)) return;
  event.preventDefault();
}

document.addEventListener("contextmenu", blockAccidentalSelection);
document.addEventListener("selectstart", blockAccidentalSelection);
document.addEventListener("dragstart", blockAccidentalSelection);

setState("empty");
