import dgram from "dgram";

const SONY_API = "schemas-sony-com:service:ScalarWebAPI:1",
  SSDP_ADDRESS = "239.255.255.250",
  SSDP_PORT = 1900;

/*
  Sample response:
    HTTP/1.1 200 OK
    CACHE-CONTROL: max-age=1800
    EXT:
    LOCATION: http://192.168.122.1:64321/dd.xml
    SERVER: UPnP/1.0 MINT-X/1.8.1
    ST: urn:schemas-sony-com:service:ScalarWebAPI:1
    USN: uuid:000000001000-1010-8000-9AF1701181A3::urn:schemas-sony-com:service:ScalarWebAPI:1
 */
export async function discoverSonyCam(): Promise<string> {
  return new Promise<string>(function (resolve, reject) {
    try {
      const mSearchMessage = Buffer.from(
        "M-SEARCH * HTTP/1.1\r\n" +
          `HOST:${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
          'MAN:"ssdp:discover"\r\n' +
          `ST:urn:${SONY_API}\r\n` +
          "MX:1\r\n" +
          "\r\n"
      );
      const client = dgram.createSocket("udp4");
      client.on("message", (message) => {
        const location = /LOCATION: (.*)/.exec(message.toString())[1];
        client.close();
        resolve(location);
      });
      client.on("error", (err) => {
        client.close();
        reject(err);
      });
      client.send(
        mSearchMessage,
        0,
        mSearchMessage.length,
        SSDP_PORT,
        SSDP_ADDRESS
      );
    } catch (error) {
      reject(error);
    }
  });
}
