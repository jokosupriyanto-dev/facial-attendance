"use client";

import {
    FaceDetector,
    FilesetResolver,
    Detection,
} from "@mediapipe/tasks-vision";
import { useEffect } from "react";

export default function Home() {
    useEffect(() => {
        let faceDetector: FaceDetector;

        const initializefaceDetector = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
            );
            faceDetector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
                    delegate: "GPU",
                },
                runningMode: "VIDEO",
            });
            enableCam();
        };

        const video = document.getElementById("webcam") as HTMLVideoElement;
        const liveView = document.getElementById("liveView") as HTMLDivElement;

        const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

        // Keep a reference of all the child elements we create
        // so we can remove them easilly on each render.
        const children: HTMLElement[] = [];

        if (hasGetUserMedia()) {
            initializefaceDetector();
        } else {
            console.warn("getUserMedia() is not supported by your browser");
        }

        // Enable the live webcam view and start detection.
        async function enableCam() {
            // getUsermedia parameters
            const constraints = {
                video: true,
            };

            // Activate the webcam stream.
            navigator.mediaDevices
                .getUserMedia(constraints)
                .then(function (stream) {
                    video.srcObject = stream;
                    video.addEventListener("loadeddata", predictWebcam);
                })
                .catch((err) => {
                    console.error(err);
                });
        }

        let processing: boolean = false;
        let sending: boolean = false;

        function sendImageToServer(video: HTMLVideoElement) {
            if (processing) return;

            new Promise(async (resolve, reject) => {
                processing = true;
                sending = true;

                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const canvasContext = canvas.getContext(
                    "2d",
                ) as CanvasRenderingContext2D;
                canvasContext.drawImage(video, 0, 0);

                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve),
                );

                if (!blob) {
                    reject(false);
                    return;
                }

                const file = new File([blob], "user.png", {
                    type: "image/png",
                    lastModified: new Date().getTime(),
                });
                const formData = new FormData();
                formData.append("image", file);

                try {
                    const response = await fetch(
                        "https://facial-attendance.requestcatcher.com/",
                        {
                            method: "POST",
                            body: formData,
                            headers: {
                                Accept: "application/json",
                            },
                            mode: "no-cors",
                        },
                    );

                    const result = await response.json();
                    console.log(result);
                } catch (err) {
                    console.error(err);
                }

                sending = false;
                resolve(true);
            })
                .then(() => {
                    setTimeout(() => {
                        processing = false;
                    }, 1000);
                })
                .catch(() => {
                    setTimeout(() => {
                        processing = false;
                    }, 1000);
                });
        }

        let lastVideoTime = -1;
        async function predictWebcam() {
            const startTimeMs = performance.now();

            if (video.currentTime !== lastVideoTime) {
                lastVideoTime = video.currentTime;
                const detections = faceDetector.detectForVideo(
                    video,
                    startTimeMs,
                ).detections;

                displayVideoDetections(detections);

                if (detections.length > 0) {
                    sendImageToServer(video);
                }
            }

            // Call this function again to keep predicting when the browser is ready
            window.requestAnimationFrame(predictWebcam);
        }

        function displayVideoDetections(detections: Detection[]) {
            // Remove any highlighting from previous frame.
            for (const child of children) {
                liveView.removeChild(child);
            }
            children.splice(0);

            // Iterate through predictions and draw them to the live view
            for (const detection of detections) {
                const boundingBox = detection.boundingBox;
                if (!boundingBox) continue;

                const p = document.createElement("p") as HTMLParagraphElement;
                p.innerText =
                    "Confidence: " +
                    Math.round(detection.categories[0].score * 100) +
                    "% .";

                p.style.cssText =
                    "left: " +
                    (video.offsetWidth -
                        boundingBox.width -
                        boundingBox.originX) +
                    "px;" +
                    "top: " +
                    (boundingBox.originY - 30) +
                    "px; " +
                    "width: " +
                    (boundingBox.width - 10) +
                    "px;";

                const highlighter = document.createElement(
                    "div",
                ) as HTMLDivElement;
                highlighter.setAttribute("class", "highlighter");
                if (sending) {
                    highlighter.classList.add("detecting");
                }
                highlighter.style.cssText =
                    "left: " +
                    (video.offsetWidth -
                        boundingBox.width -
                        boundingBox.originX) +
                    "px;" +
                    "top: " +
                    boundingBox.originY +
                    "px;" +
                    "width: " +
                    (boundingBox.width - 10) +
                    "px;" +
                    "height: " +
                    boundingBox.height +
                    "px;";

                liveView.appendChild(highlighter);
                liveView.appendChild(p);

                // Store drawn objects in memory so they are queued to delete at next call
                children.push(highlighter);
                children.push(p);
                for (const keypoint of detection.keypoints) {
                    const keypointEl = document.createElement("spam");
                    keypointEl.className = "key-point";
                    keypointEl.style.top = `${keypoint.y * video.offsetHeight - 3}px`;
                    keypointEl.style.left = `${
                        video.offsetWidth - keypoint.x * video.offsetWidth - 3
                    }px`;
                    liveView.appendChild(keypointEl);
                    children.push(keypointEl);
                }
            }
        }
    }, []);

    return (
        <div>
            <main>
                <section>
                    <div id="liveView" className="videoView">
                        <video id="webcam" autoPlay playsInline></video>
                    </div>
                </section>
            </main>
        </div>
    );
}
