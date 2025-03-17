export class AnnotationTool {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      throw new Error(`Container not found: ${containerSelector}`);
    }
    this.canvas = this.container.querySelector("canvas");
    if (!this.canvas) {
      throw new Error("Canvas element not found in container");
    }
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.displayScale = 1;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.canvas) return;

    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this.canvas.addEventListener("mousemove", this.draw.bind(this));
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("mouseleave", this.stopDrawing.bind(this));
  }

  async loadImage(source) {
    try {
      if (source instanceof Image) {
        // If source is already an Image object
        this.canvas.width = source.width;
        this.canvas.height = source.height;
        this.ctx.drawImage(source, 0, 0, source.width, source.height);
      } else {
        // If source is a data URL
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = source;
        });
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0, img.width, img.height);
      }

      // Calculate display scale based on container width
      const containerWidth = this.container.clientWidth;
      this.displayScale = containerWidth / this.canvas.width;

      // Save the initial state
      this.imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    } catch (error) {
      console.error("Error loading image:", error);
      throw error;
    }
  }

  startDrawing(event) {
    if (!this.ctx || !this.canvas) return;

    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width;
    this.startX = (event.clientX - rect.left) * scale;
    this.startY = (event.clientY - rect.top) * scale;
  }

  draw(event) {
    if (!this.isDrawing || !this.ctx || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width;
    const currentX = (event.clientX - rect.left) * scale;
    const currentY = (event.clientY - rect.top) * scale;

    // Clear the canvas and redraw the background
    this.ctx.putImageData(this.imageData, 0, 0);

    // Draw arrow
    this.drawArrow(this.startX, this.startY, currentX, currentY);
  }

  stopDrawing() {
    if (!this.ctx || !this.canvas) return;

    if (this.isDrawing) {
      this.isDrawing = false;
      // Save the current state
      this.imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }
  }

  drawArrow(fromX, fromY, toX, toY) {
    if (!this.ctx) return;

    const headLength = 30;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Draw the line
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Draw the arrow head
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fillStyle = "red";
    this.ctx.fill();
  }

  clear() {
    if (!this.ctx || !this.canvas) return;

    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save the cleared state
    this.imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
  }

  getAnnotatedImage() {
    return this.canvas ? this.canvas.toDataURL() : null;
  }
}
