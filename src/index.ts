import NodeMediaServer from "node-media-server";
import { ChildProcessByStdio, spawn } from "child_process";
import { Writable } from "stream";
import {
  discoverSonyDevice,
  fetchSonyCamSpec,
  findSonyCamUrl,
  JpegHeader,
  readJpegHeader,
  SonyCam,
  SonyCamImageResponse,
} from "node-sonycam";

const enableRtmpServer = false;
const freeRunDuration = 30000;

// Step 1. discover Sony camera service

const location = await discoverSonyDevice();
console.log("Discovered service spec location:", location);

const spec = await fetchSonyCamSpec(location);
const serviceUrl = findSonyCamUrl(spec);
console.log("Found Sony camera service url:", serviceUrl);

// Step 2. prepare connection and image listener

const sonyCam = new SonyCam(serviceUrl);
await sonyCam.connect();

let nms: NodeMediaServer;
let ffmpeg: ChildProcessByStdio<Writable, null, null>;

if (sonyCam.availableApiList.includes("getSupportedLiveviewSize")) {
  console.log(
    "Supported live view size:",
    await sonyCam.call("getSupportedLiveviewSize")
  );
}

let jpegHeader: JpegHeader,
  interval: number | null = null,
  received = 0;
const imageListener = ({ data }: SonyCamImageResponse) => {
  // fs.writeFileSync(`${frameNumber}.jpeg`, data);

  if (!interval) {
    return;
  }

  if (!jpegHeader) {
    if (enableRtmpServer) {
      nms = initRtmpServer();
    }

    jpegHeader = readJpegHeader(data);
    ffmpeg = initFfmpeg(
      jpegHeader.width,
      jpegHeader.height,
      Math.round(100000 / interval) / 100
    );
  } else {
    received++;
    ffmpeg.stdin.write(data);
  }
};
sonyCam.addListener("image", imageListener);

// Step 4. start liveview

const liveviewUrl = await sonyCam.startLiveview();
await sonyCam.fetchLiveview();
console.log("Liveview URL:", liveviewUrl);

// Step 5. calculate framerate

await new Promise<void>((r) =>
  setTimeout(() => {
    // wait for 5 seconds to get a stable median value
    const intervalListener = (i: number) => {
      console.log("Framerate:", Math.round(100000 / i) / 100, "fps");
      interval = i;
      sonyCam.removeListener("interval", intervalListener);
      r();
    };
    sonyCam.addListener("interval", intervalListener);
  }, 5000)
);

// Step 6. free run

await new Promise((r) => setTimeout(r, freeRunDuration));

// Step 7. clean up and exit

sonyCam.removeListener("image", imageListener);
await sonyCam.stopLiveview();
await sonyCam.disconnect();
if (enableRtmpServer) {
  ffmpeg.on("exit", () => {
    nms.stop();
  });
}
ffmpeg.stdin.destroy();
process.on("beforeExit", () => {
  console.log(
    "Received",
    received,
    "frames at total, resulting in",
    Math.round((received * 10000) / freeRunDuration) / 10,
    "fps"
  );
});

function initRtmpServer() {
  const nms = new NodeMediaServer({
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      // gop_cache: true,
      gop_cache: false,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      mediaroot: "./",
      port: 8000,
      allow_origin: "*",
    },
  });
  nms.run();
  return nms;
}

function initFfmpeg(width: number, height: number, fps: number) {
  console.log("Spawning ffmpeg with parameters:", { width, height, fps });

  // Official document: https://ffmpeg.org/ffmpeg-formats.html
  // Similar use case: https://dev.classmethod.jp/articles/realtime-encode-with-ffmpeg/
  const args = [
    // // read input at native frame rate
    // // "My guess is you typically don't want to use this flag when streaming from a live device, ever."
    // // https://trac.ffmpeg.org/wiki/StreamingGuide
    // "-re",

    // overwrite existing files
    "-y",

    // specify input media format
    "-r",
    String(fps),
    "-f",
    "image2pipe",
    // "rawvideo", // won't work
    "-pixel_format",
    "argb",
    "-video_size",
    `${width}x${height}`,

    // smaller probe size
    // http://fftest33.blog.fc2.com/blog-entry-109.html
    "-probesize",
    "8192",
    "-analyzeduration",
    "0",

    // get input from stdin
    "-i",
    "-",

    // // set parameters optimized for low latency
    // "-preset",
    // "ultrafast",

    // no audio
    // "-an",

    // audio with no actual sound
    "-f",
    "lavfi",
    "-i",
    "aevalsrc=0",

    // stop encoding when video is stopped
    "-shortest",
  ];

  args.push(
    ...(enableRtmpServer
      ? [
          // write to a local RTMP server
          "-f",
          "flv",
          "rtmp://localhost/live/sonycam",
        ]
      : [
          // write to a local MP4 file
          // "-vcodec",
          // "libx264",
          // "-crf",
          // "25",
          "test.mp4",
        ])
  );
  return spawn("ffmpeg", args, {
    stdio: ["pipe", "inherit", "inherit"],
  });
}
