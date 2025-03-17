class NotificationManager {
  static TIMEOUT = 3000; // 3 seconds
  static statusElement = null;

  static init(statusElement) {
    this.statusElement = statusElement;
  }

  static showMessage(message, type = "info") {
    if (!this.statusElement) return;

    this.statusElement.textContent = message;
    this.statusElement.className = `status-message ${type}`;

    if (type !== "error") {
      setTimeout(() => {
        this.statusElement.textContent = "";
        this.statusElement.className = "status-message";
      }, this.TIMEOUT);
    }
  }

  static showError(error) {
    const message = error instanceof Error ? error.message : error;
    this.showMessage(message, "error");
  }

  static showSuccess(message) {
    this.showMessage(message, "success");
  }

  static showInfo(message) {
    this.showMessage(message, "info");
  }
}
