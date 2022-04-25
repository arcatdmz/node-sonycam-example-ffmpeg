// References:
//   - https://github.com/timelapseplus/node-sony-camera
//   - https://developer.sony.com/ja/develop/cameras/

import EventEmitter from "events";
import fetch, { AbortError } from "node-fetch";
import semver from "semver";

export type RpcParam =
  | {
      [key: string]: string;
    }
  | string
  | string[]
  | number;

export type RpcRes = RpcParam[];

export interface RpcReq {
  id: number;
  version: string;
  method: string;
  params: RpcParam[];
}

export interface ImageResponse {
  frameNumber: number;
  data: Buffer;
}

export class SonyCam extends EventEmitter {
  minVersionRequired = "2.0.0";
  connecting: boolean;
  connected: boolean;
  availableApiList: string[];
  liveviewUrl: string;

  get liveviewing(): boolean {
    return !!this.liveviewUrl;
  }

  constructor(public url: string = "http://192.168.122.1:8080/sony/camera") {
    super();
  }

  async call(method: string, params: RpcParam[] = null): Promise<RpcRes> {
    const rpcReq: RpcReq = {
      id: 1,
      version: "1.0",
      method,
      params: params || [],
    };
    const body = JSON.stringify(rpcReq);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
        },
        signal: controller.signal,
        body,
      });
      if (!res.ok || res.status !== 200) {
        throw new Error(
          "Response error (http code " + res.status + " for " + method + ")"
        );
      }
      const parsedData = (await res.json()) as any,
        result = parsedData ? parsedData.result : null,
        error = parsedData ? parsedData.error : null;
      if (error) {
        // retry getEvent function call
        if (error.length > 0 && error[0] == 1 && method == "getEvent") {
          return this.call(method, params);
        }
      }
      if (error) {
        throw new Error(
          `Error during request for ${method}: ${
            error.length > 1 ? error[1] : JSON.stringify(error)
          }`
        );
      }
      return result;
    } catch (e) {
      if (e instanceof AbortError) {
        throw new Error(`Request timed out for ${method}`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  async connect(): Promise<void> {
    if (this.connecting) {
      throw new Error("Already trying to connect");
    }
    this.connecting = true;
    console.log("Connecting...");
    try {
      const version = await this.getAppVersion();
      if (!semver.gte(version, this.minVersionRequired)) {
        throw new Error(
          `Could not connect to camera -- remote control application must be updated (currently installed: ${version}, should be ${this.minVersionRequired} or newer)`
        );
      }
      console.log("App version", version);
      this.availableApiList = await this.getAvailableApiList();
      if (this.availableApiList.includes("startRecMode")) {
        await this.call("startRecMode");
      }
      this.connected = true;
    } catch (e) {
      throw e;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect() {
    if (
      Array.isArray(this.availableApiList) &&
      this.availableApiList.includes("stopRecMode")
    ) {
      await this.call("stopRecMode");
    }
    this.connected = false;
  }

  /**
   * Sample output: 2.1.2
   */
  async getAppVersion(): Promise<string> {
    const res = await this.call("getApplicationInfo");
    if (!Array.isArray(res) || res.length < 2) {
      throw new Error(
        "getApplicationInfo failed with invalid response: " +
          JSON.stringify(res)
      );
    }
    // res[0]: app name
    // res[1]: app version
    return res[1] as string;
  }

  /**
   * Sample output:
    [
      'getVersions',
      'getMethodTypes',
      'getApplicationInfo',
      'getAvailableApiList',
      'getEvent',
      'actTakePicture',
      'setSelfTimer',
      'getSelfTimer',
      'getAvailableSelfTimer',
      'getSupportedSelfTimer',
      'setContShootingMode',
      'getContShootingMode',
      'getAvailableContShootingMode',
      'getSupportedContShootingMode',
      'startLiveview',
      'stopLiveview',
      'setCameraFunction',
      'getCameraFunction',
      'getSupportedCameraFunction',
      'getAvailableCameraFunction',
      'actZoom',
      'actHalfPressShutter',
      'cancelHalfPressShutter',
      'setExposureMode',
      'getAvailableExposureMode',
      'getExposureMode',
      'getSupportedExposureMode',
      'setExposureCompensation',
      'getExposureCompensation',
      'getAvailableExposureCompensation',
      'getSupportedExposureCompensation',
      'setFNumber',
      'getFNumber',
      'getAvailableFNumber',
      'getSupportedFNumber',
      'setIsoSpeedRate',
      'getIsoSpeedRate',
      'getAvailableIsoSpeedRate',
      'getSupportedIsoSpeedRate',
      'setPostviewImageSize',
      'getPostviewImageSize',
      'getAvailablePostviewImageSize',
      'getSupportedPostviewImageSize',
      'getSupportedProgramShift',
      'setShootMode',
      'getShootMode',
      'getAvailableShootMode',
      'getSupportedShootMode',
      'getShutterSpeed',
      'getAvailableShutterSpeed',
      'getSupportedShutterSpeed',
      'setWhiteBalance',
      'getWhiteBalance',
      'getSupportedWhiteBalance',
      'getAvailableWhiteBalance',
      'setFlashMode',
      'getFlashMode',
      'getAvailableFlashMode',
      'getSupportedFlashMode',
      'setFocusMode',
      'getFocusMode',
      'getAvailableFocusMode',
      'getSupportedFocusMode',
      'setStillSize',
      'getStillSize',
      'getAvailableStillSize',
      'getSupportedStillSize',
      'setStillQuality',
      'getAvailableStillQuality',
      'getStillQuality',
      'getSupportedStillQuality',
      'getSupportedZoomSetting',
      'getStorageInformation',
      'setBeepMode',
      'getBeepMode',
      'getAvailableBeepMode',
      'getSupportedBeepMode',
      'setTrackingFocus',
      'getTrackingFocus',
      'getAvailableTrackingFocus',
      'getSupportedTrackingFocus',
      'actFormatStorage',
      'setLiveviewFrameInfo',
      'getLiveviewFrameInfo'
    ]
   */
  async getAvailableApiList(): Promise<string[]> {
    const res = await this.call("getAvailableApiList", null);
    if (!Array.isArray(res) || res.length < 1) {
      throw new Error(
        "getAvailableApiList failed with invalid response: " +
          JSON.stringify(res)
      );
    }
    return res[0] as string[];
  }

  async startLiveview(size?: "M" | "L"): Promise<string> {
    const res = await this.call(
      size ? "startLiveviewWithSize" : "startLiveview",
      size ? [size] : null
    );
    if (!Array.isArray(res) || res.length < 1) {
      throw new Error(
        "startLivewview failed with invalid response: " + JSON.stringify(res)
      );
    }
    this.liveviewUrl = res[0] as string;
    return this.liveviewUrl;
  }

  async stopLiveview(): Promise<void> {
    console.log("Stopping live view");
    await this.call("stopLiveview", null);
    this.liveviewUrl = null;
    console.log("Stopped live view");
  }

  async fetchLiveview(): Promise<void> {
    if (!this.liveviewing) {
      throw new Error("Call startLiveview before fetching images");
    }
    const res = await fetch(this.liveviewUrl);
    if (!res.ok || res.status !== 200) {
      throw new Error(
        "Response error (http code " + res.status + " for fetching images)"
      );
    }
    const COMMON_HEADER_SIZE = 8,
      PAYLOAD_HEADER_SIZE = 128,
      JPEG_SIZE_POSITION = 4,
      PADDING_SIZE_POSITION = 7;
    let lastTimestamp = -1,
      timestamps: number[] = [],
      frameNumber = 0,
      payloadType = 0,
      payloadDataSize = 0,
      paddingSize = 0,
      bufferIndex = 0,
      buffer = Buffer.alloc(0),
      imageBuffer: Buffer = null;
    res.body.on("data", (chunk: Buffer) => {
      if (!this.liveviewUrl) {
        return;
      }
      if (payloadDataSize === 0) {
        // console.log("---");
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.byteLength >= COMMON_HEADER_SIZE + PAYLOAD_HEADER_SIZE) {
          frameNumber = buffer.readUint16BE(2);
          const timestamp = buffer.readUint32BE(4);
          payloadType = buffer.readUInt8(1);
          payloadDataSize =
            buffer.readUInt8(COMMON_HEADER_SIZE + JPEG_SIZE_POSITION) *
              0x10000 +
            buffer.readUInt16BE(COMMON_HEADER_SIZE + JPEG_SIZE_POSITION + 1);
          paddingSize = buffer.readUInt8(
            COMMON_HEADER_SIZE + PADDING_SIZE_POSITION
          );
          if (lastTimestamp >= 0) {
            const elapsed = timestamp - lastTimestamp;
            timestamps.push(elapsed);
            if (timestamps.length > 51) {
              timestamps.shift();
            }
            timestamps.sort();
            const interval = timestamps[Math.floor(timestamps.length / 2)];
            // const interval =
            //   timestamps.reduce((p, c) => p + c, 0) /
            //   Math.min(timestamps.length, 51);
            this.emit("interval", interval);
          }
          lastTimestamp = timestamp;

          // // common header
          // console.log("start byte", buffer.readUInt8(0) === 0xff);
          // console.log("payload type", payloadType);
          // console.log("frame number", timestamp);
          // console.log("timestamp", buffer.readUint32BE(4));

          // // payload header
          // console.log("payload header", buffer.readUint32BE(8) === 0x24356879);
          // console.log("payload data size", payloadDataSize);
          // console.log("padding size", paddingSize);

          imageBuffer = Buffer.alloc(payloadDataSize);
          buffer = buffer.slice(COMMON_HEADER_SIZE + PAYLOAD_HEADER_SIZE);
          if (buffer.byteLength > 0) {
            buffer.copy(imageBuffer, bufferIndex, 0, buffer.byteLength);
            bufferIndex += buffer.byteLength;
          }
        }
      } else {
        const chunkLength = chunk.byteLength;
        chunk.copy(imageBuffer, bufferIndex, 0, chunkLength);
        bufferIndex += chunkLength;
        if (chunkLength < payloadDataSize) {
          payloadDataSize -= chunkLength;
        } else {
          if (payloadType === 0x01) {
            this.emit("image", {
              frameNumber,
              data: imageBuffer,
            });
          }
          buffer = Uint8Array.prototype.slice.call(
            chunk,
            payloadDataSize + paddingSize
          );
          payloadDataSize = 0;
          bufferIndex = 0;
        }
      }
    });
  }
}
