const sourceStreamUrl = 'http://192.168.0.241:8080/screencast.mjpeg';

const sourceSize = {
  width: 0,
  height: 0,
};

let imgElement;
let rectangleOverlayCanvasElement;
let guidesOverlayCanvasElement;
let canvasElement;
let popupElement;
let mouseTrackerElement;
let imgXOffset = 0;
let imgYOffset = 0;
let notificationsContainerElement;

function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

window.onload = debounce(
  function () {
    window.onresize = window.onload;
    const sizeReadingImg = document.createElement('img');

    notificationsContainerElement = document.getElementsByClassName(
      'notifications-container',
    )[0];

    sizeReadingImg.src = sourceStreamUrl;
    sizeReadingImg.onload = function () {
      sourceSize.width = sizeReadingImg.width;
      sourceSize.height = sizeReadingImg.height;
      console.log(
        `Stream source size: ${sourceSize.width}x${sourceSize.height}`,
      );
      sizeReadingImg.remove();

      document.getElementById('url-used').innerText = sourceStreamUrl;

      imgElement = document.getElementById('stream');
      imgElement.style.aspectRatio = `${sourceSize.width}/${sourceSize.height}`;
      imgElement.setAttribute('src', sourceStreamUrl);

      document.getElementById(
        'capture',
      ).style.aspectRatio = `${sourceSize.width}/${sourceSize.height}`;

      imgXOffset = imgElement.getBoundingClientRect().x;
      imgYOffset = imgElement.getBoundingClientRect().y;

      rectangleOverlayCanvasElement =
        document.getElementById('rectangle-overlay');
      rectangleOverlayCanvasElement.width = sourceSize.width;
      rectangleOverlayCanvasElement.height = sourceSize.height;
      guidesOverlayCanvasElement = document.getElementById('guides-overlay');
      guidesOverlayCanvasElement.width = sourceSize.width;
      guidesOverlayCanvasElement.height = sourceSize.height;

      canvasElement = document.getElementById('copy-canvas');
      canvasElement.style.display = 'none';
      canvasElement.width = sourceSize.width;
      canvasElement.height = sourceSize.height;
      document.body.appendChild(canvasElement);

      popupElement = document.getElementById('popup');

      mouseTrackerElement = document.getElementById('tracker-container');

      setupTheTracker();
    };
  },
  500,
  false,
);

function mapScreenPositionToSourcePosition(x, y) {
  return {
    x: Math.round((x / imgElement.width) * sourceSize.width),
    y: Math.round((y / imgElement.height) * sourceSize.height),
  };
}

function setupTheTracker() {
  this.mouseClicked = false;
  this.dragStart = false;
  imgElement.style.cursor = 'initial';
  this.clickStart = {
    x: 0,
    y: 0,
  };
  this.currentMousePosition = {
    x: 0,
    y: 0,
  };

  imgElement.addEventListener('dragstart', e => {
    e.preventDefault();
  });

  imgElement.addEventListener('mouseleave', () => {
    mouseTrackerElement.style.display = 'none';
    clearGuidesOverlay();
  });

  imgElement.addEventListener('mouseenter', () => {
    mouseTrackerElement.style.display = 'block';
  });

  imgElement.addEventListener('mousedown', e => {
    this.mouseClicked = true;
    this.clickStart = this.currentMousePosition;
  });

  document.addEventListener('mouseup', e => {
    if (dragStart) {
      const clickEnd = this.currentMousePosition;

      const startX = Math.min(this.clickStart.x, clickEnd.x);
      const startY = Math.min(this.clickStart.y, clickEnd.y);
      const endX = Math.max(this.clickStart.x, clickEnd.x);
      const endY = Math.max(this.clickStart.y, clickEnd.y);

      const width = endX - startX;
      const height = endY - startY;

      const streamSourceStartPosition = mapScreenPositionToSourcePosition(
        startX,
        startY,
      );
      const streamSourceRectangeSize = mapScreenPositionToSourcePosition(
        width,
        height,
      );
      clearRectangleOverlay();
      capture(
        streamSourceStartPosition.x,
        streamSourceStartPosition.y,
        streamSourceRectangeSize.x,
        streamSourceRectangeSize.y,
        'rectangle selection capture',
      );
    }
    this.mouseClicked = false;
    this.dragStart = false;
    imgElement.style.cursor = 'initial';
  });

  imgElement.addEventListener(
    'mousemove',
    e => {
      this.currentMousePosition = getMousePositionOnImage(e);
      this.streamSourceScreenPosition = mapScreenPositionToSourcePosition(
        this.currentMousePosition.x,
        this.currentMousePosition.y,
      );

      const str =
        'X : ' +
        this.streamSourceScreenPosition.x +
        ', ' +
        'Y : ' +
        this.streamSourceScreenPosition.y;

      mouseTrackerElement.children[0].innerHTML = str;
      mouseTrackerElement.style.left = e.pageX + 15 + 'px';
      mouseTrackerElement.style.top = e.pageY + 15 + 'px';

      drawMouseGuidesOnOverlay(
        this.streamSourceScreenPosition.x,
        this.streamSourceScreenPosition.y,
      );

      if (this.mouseClicked) {
        if (
          Math.abs(this.currentMousePosition.x - this.clickStart.x) > 5 ||
          Math.abs(this.currentMousePosition.y - this.clickStart.y) > 5
        ) {
          this.dragStart = true;
          imgElement.style.cursor = 'none';
        }
      }

      if (this.dragStart) {
        const startPosition = this.clickStart;
        const endPosition = this.currentMousePosition;
        const startX = Math.min(startPosition.x, endPosition.x);
        const startY = Math.min(startPosition.y, endPosition.y);
        const rectWidth = Math.abs(startPosition.x - endPosition.x);
        const rectHeight = Math.abs(startPosition.y - endPosition.y);

        const obsidianSizedStart = mapScreenPositionToSourcePosition(
          startX,
          startY,
        );

        const obsidianSizedDimensions = mapScreenPositionToSourcePosition(
          rectWidth,
          rectHeight,
        );

        drawRectangleOnOverlay(
          obsidianSizedStart.x,
          obsidianSizedStart.y,
          obsidianSizedDimensions.x,
          obsidianSizedDimensions.y,
        );
      }
    },
    0,
  );
}

function getMousePositionOnImage(e) {
  const x = e.pageX - imgXOffset;
  const y = e.pageY - imgYOffset;
  return { x, y };
}

function drawRectangleOnOverlay(startX, startY, rectWidth, rectHeight) {
  clearRectangleOverlay();
  const context = rectangleOverlayCanvasElement.getContext('2d');
  context.beginPath();
  context.rect(startX, startY, rectWidth, rectHeight);
  context.strokeStyle = '#3c9f40f0';
  context.lineWidth = 1;
  context.stroke();
}

function drawMouseGuidesOnOverlay(x, y) {
  clearGuidesOverlay();
  const context = guidesOverlayCanvasElement.getContext('2d');
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, sourceSize.height);
  context.moveTo(0, y);
  context.lineTo(sourceSize.width, y);
  context.strokeStyle = '#6c9f50b0';
  context.lineWidth = 1;
  context.stroke();
}

function clearRectangleOverlay() {
  const context = rectangleOverlayCanvasElement.getContext('2d');
  context.clearRect(
    0,
    0,
    rectangleOverlayCanvasElement.width,
    rectangleOverlayCanvasElement.height,
  );
}

function clearGuidesOverlay() {
  const context = guidesOverlayCanvasElement.getContext('2d');
  context.clearRect(
    0,
    0,
    guidesOverlayCanvasElement.width,
    guidesOverlayCanvasElement.height,
  );
}

function capture(
  startX = 0,
  startY = 0,
  sourceWidth = sourceSize.width,
  sourceHeight = sourceSize.height,
  method = 'full screen capture',
) {
  const context = canvasElement.getContext('2d');
  context.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasElement.width = sourceWidth;
  canvasElement.height = sourceHeight;

  context.drawImage(
    imgElement,
    startX,
    startY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  try {
    canvasElement.toBlob(data => {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': data })])
        .then(() => {
          showPopup('Image copied to clipboard using', method);
        })
        .catch(err => {
          showPopup(
            'Error: Unable to copy image to clipboard:' + err,
            method,
            'error',
          );
        });
    });
  } catch (err) {
    console.error(`Error: ${err}`);
  }
}

/**
 * Show a popup message
 * @param {string} message - The message to display
 * @param {string} type - The type of message to display (ok, error, warn)
 * @param {number} duration - The duration to display the message
 * @returns {void}
 * */
function showPopup(message, method, type = 'ok', duration = 10 * 1000) {
  let allCurrentPopups = Array.from(document.getElementsByClassName('popup'));
  while (allCurrentPopups.length > 5) {
    allCurrentPopups[0].parentElement.removeChild(allCurrentPopups[0]);
    allCurrentPopups = Array.from(document.getElementsByClassName('popup'));
    let previousPopupBottom = 0;
    allCurrentPopups.forEach(popup => {
      popup.style.top = `calc(${previousPopupBottom}px + 1rem)`;
      previousPopupBottom = popup.getBoundingClientRect().bottom;
    });
  }
  const lastPopup = allCurrentPopups[allCurrentPopups.length - 1];
  const lastCurrentPopupBottomPosition = lastPopup
    ? lastPopup.getBoundingClientRect().bottom
    : 0;

  const popup = document.createElement('div');
  popup.classList.add('popup', type);
  popup.style.transition = `opacity ease-out ${
    Math.round((duration / 1000 / 3) * 10) / 10
  }s`;

  const popupMethod = document.createElement('span');
  popupMethod.classList.add('popup-method');
  popupMethod.innerHTML = method;
  popup.appendChild(popupMethod);

  const popupTimestamp = new Date().toLocaleString();
  const popupTimestampElement = document.createElement('span');
  popupTimestampElement.classList.add('popup-timestamp');
  popupTimestampElement.innerHTML = popupTimestamp;
  popup.appendChild(popupTimestampElement);

  const messageContainerElement = document.createElement('div');
  messageContainerElement.classList.add('popup-message');
  messageContainerElement.innerHTML = message;
  popup.appendChild(messageContainerElement);

  notificationsContainerElement.appendChild(popup);
  popup.classList.add('show');
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => {
      if (notificationsContainerElement.contains(popup)) {
        notificationsContainerElement.removeChild(popup);
      }
    }, duration / 3);
  }, (duration * 2) / 3);
}
