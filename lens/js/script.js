const CATEGORIES = {
  people: {
    label: "People",
    prompt: "Who are the people in this photo?",
    kicker: "People lens",
  },
  moment: {
    label: "Moment",
    prompt: "What was happening before or after this moment?",
    kicker: "Moment lens",
  },
  perspective: {
    label: "Perspective",
    prompt: "How did someone else remember this day?",
    kicker: "Perspective lens",
  },
  hidden: {
    label: "Hidden",
    prompt: "What is not visible in the photo?",
    kicker: "Hidden lens",
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

let selectedCategory = "people";
let savedStories = createEmptyStories();
let draftStories = createEmptyStories();
let mediaRecorder = null;
let activeStream = null;
let audioChunks = [];
let currentAudio = null;
let currentAudioButton = null;
let recordingTimer = null;
let recordingStartedAt = 0;
let activeDrag = null;
let lensOpenAmounts = createLensOpenAmounts();

const body = document.body;
const photoShell = document.getElementById("photoShell");
const photoImage = document.getElementById("photoImage");
const choosePhotoButton = document.getElementById("choosePhotoButton");
const photoInput = document.getElementById("photoInput");
const addStoryButton = document.getElementById("addStoryButton");
const editStoryButton = document.getElementById("editStoryButton");
const storyModal = document.getElementById("storyModal");
const closeModalButton = document.getElementById("closeModalButton");
const categoryButtons = document.querySelectorAll(".category-btn");
const storyText = document.getElementById("storyText");
const textCounter = document.getElementById("textCounter");
const recordButton = document.getElementById("recordButton");
const stopButton = document.getElementById("stopButton");
const audioPreview = document.getElementById("audioPreview");
const deleteRecordingButton = document.getElementById("deleteRecordingButton");
const recordingNote = document.getElementById("recordingNote");
const saveStoryButton = document.getElementById("saveStoryButton");
const revealPanel = document.getElementById("revealPanel");
const revealKicker = document.getElementById("revealKicker");
const revealStories = document.getElementById("revealStories");
const storyTemplate = document.getElementById("storyTemplate");
const traceLayer = document.getElementById("traceLayer");
const viewerHelp = document.getElementById("viewerHelp");
const lensHandles = document.querySelectorAll(".lens-handle");

function init() {
  setupPhotoUpload();
  setupModal();
  setupRecorder();
  setupLensDrag();
  updatePrototypeState();
}

function createLensOpenAmounts() {
  return CATEGORY_KEYS.reduce((result, category) => {
    result[category] = 0;
    return result;
  }, {});
}

function createEmptyStories() {
  return CATEGORY_KEYS.reduce((result, category) => {
    result[category] = {
      text: "",
      audioUrl: null,
      audioName: "",
      audioDuration: 0,
    };
    return result;
  }, {});
}

function cloneStories(source) {
  const clone = createEmptyStories();
  CATEGORY_KEYS.forEach((category) => {
    clone[category] = { ...source[category] };
  });
  return clone;
}

function hasStoryValue(story) {
  return Boolean(story?.text?.trim() || story?.audioUrl);
}

function hasAnyStory(stories = savedStories) {
  return CATEGORY_KEYS.some((category) => hasStoryValue(stories[category]));
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
  recordingNote.textContent = "Recording 0:00";
  recordingTimer = window.setInterval(() => {
    const elapsed = (Date.now() - recordingStartedAt) / 1000;
    recordingNote.textContent = `Recording ${formatTime(elapsed)}`;
  }, 250);
}

function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
}

function setupPhotoUpload() {
  choosePhotoButton.addEventListener("click", () => photoInput.click());

  photoShell.addEventListener("click", (event) => {
    const alreadyHasPhoto = body.classList.contains("has-photo");
    const isInteractiveControl = event.target.closest(".lens-handle, .reveal-panel, .add-story, .edit-story, button, input");
    if (!alreadyHasPhoto && !isInteractiveControl) {
      photoInput.click();
    }
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    photoImage.src = url;
    body.classList.add("has-photo");
  });
}

function setupModal() {
  addStoryButton.addEventListener("click", () => openModal(false));
  editStoryButton.addEventListener("click", () => openModal(true));
  closeModalButton.addEventListener("click", closeModal);

  storyModal.addEventListener("click", (event) => {
    if (event.target === storyModal) closeModal();
  });

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => switchCategory(button.dataset.category));
  });

  storyText.addEventListener("input", () => {
    textCounter.textContent = storyText.value.length;
  });

  saveStoryButton.addEventListener("click", saveAllStories);
}

function openModal(useSavedStories) {
  stopCurrentAudio();
  hideReveal();
  stopRecordingIfNeeded();

  draftStories = useSavedStories ? cloneStories(savedStories) : createEmptyStories();
  selectedCategory = "people";

  storyModal.classList.remove("is-hidden");
  storyModal.setAttribute("aria-hidden", "false");
  loadCategoryIntoForm();

  setTimeout(() => storyText.focus(), 60);
}

function closeModal() {
  stopRecordingIfNeeded();
  storyModal.classList.add("is-hidden");
  storyModal.setAttribute("aria-hidden", "true");
}

function switchCategory(nextCategory) {
  if (selectedCategory === nextCategory) return;

  if (mediaRecorder && mediaRecorder.state === "recording") {
    recordingNote.textContent = "Stop the recording before changing lens.";
    return;
  }

  persistCurrentCategory();
  selectedCategory = nextCategory;
  loadCategoryIntoForm();
}

function persistCurrentCategory() {
  draftStories[selectedCategory] = {
    ...draftStories[selectedCategory],
    text: storyText.value.trim(),
  };
}

function loadCategoryIntoForm() {
  const story = draftStories[selectedCategory];

  categoryButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.category === selectedCategory);
  });

  storyText.placeholder = CATEGORIES[selectedCategory].prompt;
  storyText.value = story.text || "";
  textCounter.textContent = storyText.value.length;

  if (story.audioUrl) {
    audioPreview.src = story.audioUrl;
    audioPreview.classList.remove("is-hidden");
    deleteRecordingButton?.classList.remove("is-hidden");
    recordButton.textContent = "Record again";
    const durationText = story.audioDuration ? ` (${formatTime(story.audioDuration)})` : "";
    recordingNote.textContent = `Voice note added for this lens${durationText}.`;
  } else {
    audioPreview.removeAttribute("src");
    audioPreview.classList.add("is-hidden");
    deleteRecordingButton?.classList.add("is-hidden");
    recordButton.textContent = "Tap to record";
    recordingNote.textContent = "The recording stays only in this open page.";
  }

  recordButton.disabled = false;
  recordButton.classList.remove("is-recording");
  stopButton.classList.add("is-hidden");
}

async function setupRecorder() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    recordButton.disabled = true;
    recordButton.textContent = "Recording not supported here";
    recordingNote.textContent = "Try opening the prototype in a modern browser.";
    return;
  }

  recordButton.addEventListener("click", startRecording);
  stopButton.addEventListener("click", stopRecording);
  deleteRecordingButton?.addEventListener("click", deleteCurrentRecording);
}

async function startRecording() {
  try {
    stopCurrentAudio();
    activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(activeStream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", finishRecording);

    mediaRecorder.start();
    recordButton.disabled = true;
    recordButton.textContent = "Recording…";
    recordButton.classList.add("is-recording");
    stopButton.classList.remove("is-hidden");
    deleteRecordingButton?.classList.add("is-hidden");
    startRecordingTimer();
  } catch (error) {
    recordingNote.textContent = "Microphone access was blocked. Allow it in the browser and try again.";
    console.error(error);
  }
}

function finishRecording() {
  stopRecordingTimer();
  const recordedSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
  const mimeType = mediaRecorder?.mimeType || "audio/webm";
  const audioBlob = new Blob(audioChunks, { type: mimeType });
  const audioUrl = URL.createObjectURL(audioBlob);

  draftStories[selectedCategory] = {
    ...draftStories[selectedCategory],
    audioUrl,
    audioName: `${selectedCategory}-voice-note`,
    audioDuration: recordedSeconds,
  };

  audioPreview.src = audioUrl;
  audioPreview.classList.remove("is-hidden");
  deleteRecordingButton?.classList.remove("is-hidden");

  stopActiveStream();
  recordButton.disabled = false;
  recordButton.textContent = "Record again";
  recordButton.classList.remove("is-recording");
  stopButton.classList.add("is-hidden");
  recordingNote.textContent = `Recording ready (${formatTime(recordedSeconds)}). You can save it with this lens.`;
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

function stopRecordingIfNeeded() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  stopRecordingTimer();
  stopActiveStream();
}

function stopActiveStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
}

function deleteCurrentRecording() {
  stopCurrentAudio();
  stopRecordingIfNeeded();

  draftStories[selectedCategory] = {
    ...draftStories[selectedCategory],
    audioUrl: null,
    audioName: "",
    audioDuration: 0,
  };

  audioPreview.pause();
  audioPreview.removeAttribute("src");
  audioPreview.classList.add("is-hidden");
  deleteRecordingButton?.classList.add("is-hidden");
  recordButton.disabled = false;
  recordButton.textContent = "Tap to record";
  recordButton.classList.remove("is-recording");
  stopButton.classList.add("is-hidden");
  recordingNote.textContent = "Voice note deleted.";
}

function saveAllStories() {
  persistCurrentCategory();

  if (!hasAnyStory(draftStories)) {
    recordingNote.textContent = "Add a short note or record a voice before saving.";
    return;
  }

  savedStories = cloneStories(draftStories);
  closeModal();
  updatePrototypeState();

  const firstCategory = CATEGORY_KEYS.find((category) => hasStoryValue(savedStories[category])) || "people";
  const matchingHandle = document.querySelector(`.lens-handle[data-category="${firstCategory}"]`);
  matchingHandle?.classList.add("is-dragging");
  setTimeout(() => matchingHandle?.classList.remove("is-dragging"), 600);
}

function updatePrototypeState() {
  const hasStories = hasAnyStory();
  body.classList.toggle("has-stories", hasStories);
  renderTraceDots();

  viewerHelp.textContent = hasStories
    ? "Pull a lens into the photo to read or play what was added."
    : "Add a story first. The lenses appear after saving.";

  lensHandles.forEach((handle) => {
    const category = handle.dataset.category;
    const shouldShow = hasStoryValue(savedStories[category]);
    handle.classList.toggle("has-story", shouldShow);
    if (!shouldShow) setLensOpenAmount(handle, 0);
  });
}

function renderTraceDots() {
  traceLayer.innerHTML = "";

  CATEGORY_KEYS.forEach((category) => {
    if (!hasStoryValue(savedStories[category])) return;

    const dot = document.createElement("span");
    dot.className = `trace-dot ${category}`;
    traceLayer.appendChild(dot);
  });
}

function setupLensDrag() {
  lensHandles.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => beginDrag(event, handle));
  });

  photoShell.addEventListener("pointerdown", (event) => {
    const touchedLens = event.target.closest(".lens-handle, .reveal-panel");
    if (!touchedLens && getOpenCategory()) closeAllCurtains();
  });

  document.addEventListener("pointermove", moveDrag);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
}

function beginDrag(event, handle) {
  const category = handle.dataset.category;
  if (!hasStoryValue(savedStories[category])) return;

  event.preventDefault();
  stopCurrentAudio();

  const isAlreadyOpen = (lensOpenAmounts[category] || 0) > 8;

  lensHandles.forEach((otherHandle) => {
    if (otherHandle !== handle) setLensOpenAmount(otherHandle, 0, true);
  });

  activeDrag = {
    category,
    handle,
    pointerId: event.pointerId,
    startX: event.clientX,
    startOpen: lensOpenAmounts[category] || 0,
    side: getLensSide(category),
    moved: false,
    wasOpen: isAlreadyOpen,
  };

  handle.setPointerCapture?.(event.pointerId);
  handle.classList.add("is-dragging");
  revealPanel.classList.add("is-dragging");

  if (isAlreadyOpen) {
    showRevealForHandle(handle, lensOpenAmounts[category]);
  }
}

function moveDrag(event) {
  if (!activeDrag) return;

  // The curtain opens sideways across the photo.
  // Left tabs open by moving right. Right tabs open by moving left.
  const rawDelta = event.clientX - activeDrag.startX;
  const direction = activeDrag.side === "left" ? 1 : -1;
  const delta = rawDelta * direction;
  const amount = clamp(activeDrag.startOpen + delta, 0, getMaxOpenAmount());

  if (Math.abs(rawDelta) > 5) activeDrag.moved = true;

  setLensOpenAmount(activeDrag.handle, amount);

  if (amount > 4) {
    showRevealForHandle(activeDrag.handle, amount);
  } else {
    collapseRevealTo(activeDrag.handle);
  }
}

function endDrag() {
  if (!activeDrag) return;

  const { handle, category, moved, wasOpen } = activeDrag;
  const currentAmount = lensOpenAmounts[category] || 0;

  handle.classList.remove("is-dragging");
  revealPanel.classList.remove("is-dragging");

  if (!moved && wasOpen) {
    // Tap an open curtain to close it.
    closeCurtain(handle);
  } else if (!moved && !wasOpen) {
    // Tap a closed lens to open it. Drag still works as before.
    const restingAmount = getMaxOpenAmount();
    setLensOpenAmount(handle, restingAmount, true);
    showRevealForHandle(handle, restingAmount);
  } else if (currentAmount < 34) {
    closeCurtain(handle);
  } else {
    // Keep it where the user released it, within the shorter Figma-like range.
    const restingAmount = clamp(currentAmount, 54, getMaxOpenAmount());
    setLensOpenAmount(handle, restingAmount, true);
    showRevealForHandle(handle, restingAmount);
  }

  activeDrag = null;
}

function getOpenCategory() {
  return CATEGORY_KEYS.find((category) => (lensOpenAmounts[category] || 0) > 8) || null;
}

function closeAllCurtains() {
  lensHandles.forEach((handle) => closeCurtain(handle, false));
  setTimeout(() => hideReveal(), 190);
}

function closeCurtain(handle, hideAfter = true) {
  setLensOpenAmount(handle, 0, true);
  collapseRevealTo(handle);
  if (hideAfter) setTimeout(() => hideReveal(), 190);
}

function collapseRevealTo(handle) {
  if (!handle) {
    revealPanel.style.width = "0px";
    revealPanel.style.opacity = "0";
    return;
  }

  const category = handle.dataset.category;
  const side = getLensSide(category);
  const row = getLensRow(category);
  const shellRect = photoShell.getBoundingClientRect();
  const handleWidth = getHandleWidth();
  const panelHeight = getPanelHeight(shellRect.height);

  revealPanel.className = `reveal-panel ${category} curtain-${side}`;
  revealPanel.style.width = "0px";
  revealPanel.style.opacity = "0";
  revealPanel.style.setProperty("--content-left", "16px");
  revealPanel.style.setProperty("--content-width", `${getRevealContentWidth()}px`);
  revealPanel.style.top = row === "top" ? "0px" : `${shellRect.height - panelHeight}px`;
  revealPanel.style.left = side === "left" ? "0px" : `${shellRect.width - handleWidth}px`;
}

function getLensSide(category) {
  return category === "people" || category === "perspective" ? "left" : "right";
}

function getLensRow(category) {
  return category === "people" || category === "moment" ? "top" : "bottom";
}

function getMaxOpenAmount() {
  const shellRect = photoShell.getBoundingClientRect();
  const handleWidth = getHandleWidth();
  // Match the Figma movement: the stripe should only open about half-way,
  // not travel across the whole photo or run into the opposite stripe.
  return Math.max(0, Math.min(shellRect.width * 0.52, shellRect.width - (handleWidth * 2) - 34));
}

function getHandleWidth() {
  const firstHandle = lensHandles[0];
  return firstHandle?.getBoundingClientRect().width || 92;
}

function getPanelHeight(shellHeight) {
  return Math.max(106, Math.min(146, shellHeight * 0.48));
}

function setLensOpenAmount(handle, amount, animated = false) {
  const category = handle.dataset.category;
  const side = getLensSide(category);
  const signedAmount = side === "left" ? amount : -amount;

  lensOpenAmounts[category] = amount;
  handle.classList.toggle("is-settling", animated);
  handle.style.transform = `translateX(${signedAmount}px)`;
  handle.classList.toggle("is-open", amount > 8);

  if (animated) {
    window.setTimeout(() => handle.classList.remove("is-settling"), 190);
  }
}

function showRevealForHandle(handle, amount = lensOpenAmounts[handle.dataset.category] || 0) {
  const category = handle.dataset.category;
  const story = savedStories[category];

  if (!hasStoryValue(story)) {
    hideReveal();
    return;
  }

  const shellRect = photoShell.getBoundingClientRect();
  const side = getLensSide(category);
  const row = getLensRow(category);
  const panelHeight = getPanelHeight(shellRect.height);
  const panelWidth = Math.max(0, amount);
  const contentWidth = getRevealContentWidth(panelWidth);
  const edgePadding = 12;

  let panelLeft;
  let contentLeft;

  if (side === "left") {
    panelLeft = 0;
    contentLeft = Math.max(edgePadding, panelWidth - contentWidth - edgePadding);
  } else {
    panelLeft = shellRect.width - amount;
    contentLeft = edgePadding;
  }

  if (contentWidth <= 0 || panelWidth < 60) {
    revealPanel.style.opacity = String(clamp(panelWidth / 60, 0, 0.35));
  } else {
    revealPanel.style.opacity = amount > 8 ? "0.92" : String(clamp(amount / 8, 0, 0.92));
  }

  revealPanel.style.left = `${panelLeft}px`;
  revealPanel.style.top = row === "top" ? "0px" : `${shellRect.height - panelHeight}px`;
  revealPanel.style.width = `${panelWidth}px`;
  revealPanel.style.height = `${panelHeight}px`;
  revealPanel.style.maxHeight = `${panelHeight}px`;
  revealPanel.style.setProperty("--content-width", `${contentWidth}px`);
  revealPanel.style.setProperty("--content-left", `${contentLeft}px`);
  revealPanel.className = `reveal-panel ${category} curtain-${side} row-${row}`;
  revealPanel.dataset.category = category;
  revealKicker.textContent = CATEGORIES[category].kicker;

  populateRevealStory(category);
  revealPanel.classList.remove("is-hidden");
}

function getRevealContentWidth(panelWidth = getMaxOpenAmount()) {
  const shellRect = photoShell.getBoundingClientRect();
  const safePanelWidth = Math.max(0, panelWidth - 26);

  if (safePanelWidth <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      220,
      safePanelWidth,
      shellRect.width * 0.56
    )
  );
}

function populateRevealStory(category) {
  revealStories.innerHTML = "";
  const story = savedStories[category];

  if (!hasStoryValue(story)) {
    return;
  }

  const node = storyTemplate.content.cloneNode(true);
  const text = node.querySelector(".story-text");
  const playButton = node.querySelector(".play-voice");

  text.textContent = story.text || "Voice note added.";

  if (story.audioUrl) {
    playButton.classList.remove("is-hidden");
    playButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    playButton.addEventListener("click", (event) => {
      event.stopPropagation();
      playVoice(story.audioUrl, playButton);
    });
  }

  revealStories.appendChild(node);
}

function playVoice(audioUrl, button) {
  stopCurrentAudio();

  currentAudio = new Audio(audioUrl);
  currentAudioButton = button;
  button.textContent = "0:00";

  currentAudio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(currentAudio.duration)) {
      button.textContent = `0:00 / ${formatTime(currentAudio.duration)}`;
    }
  });

  currentAudio.addEventListener("timeupdate", () => {
    if (!currentAudio) return;
    const duration = Number.isFinite(currentAudio.duration) ? currentAudio.duration : 0;
    button.textContent = duration
      ? `${formatTime(currentAudio.currentTime)} / ${formatTime(duration)}`
      : formatTime(currentAudio.currentTime);
  });

  currentAudio.addEventListener("ended", () => {
    button.textContent = "Play voice";
    currentAudio = null;
    currentAudioButton = null;
  });

  currentAudio.play().catch((error) => {
    button.textContent = "Could not play";
    currentAudio = null;
    currentAudioButton = null;
    console.error(error);
  });
}

function stopCurrentAudio() {
  if (!currentAudio) return;

  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;

  if (currentAudioButton) {
    currentAudioButton.textContent = "Play voice";
    currentAudioButton = null;
  }
}

function hideReveal() {
  revealPanel.classList.add("is-hidden");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
