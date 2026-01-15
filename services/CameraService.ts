export class CameraService {
  static async checkPermission(): Promise<{ granted: boolean }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return { granted: true };
    } catch (e) {
      return { granted: false };
    }
  }
  static async takePhoto(
    facingMode: "user" | "environment"
  ): Promise<Blob | null> {
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: facingMode },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      let blob: Blob | null = null;
      if ("ImageCapture" in window) {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          blob = await imageCapture.takePhoto();
        } catch (e) {}
      }
      if (!blob) {
        const video = document.createElement("video");
        video.srcObject = stream;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(() => resolve());
          };
        });
        await new Promise((r) => setTimeout(r, 500));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg")
          );
        }
      }
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      return blob;
    } catch (e) {
      return null;
    }
  }
}
