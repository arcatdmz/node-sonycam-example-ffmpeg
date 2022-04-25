import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";

const parser = new XMLParser();

/*
  {
    serviceType: 'urn:schemas-sony-com:service:ScalarWebAPI:1',
    serviceId: 'urn:schemas-sony-com:serviceId:ScalarWebAPI',
    SCPDURL: '',
    controlURL: '',
    eventSubURL: ''
  },
  {
    serviceType: 'urn:schemas-sony-com:service:DigitalImaging:1',
    serviceId: 'urn:schemas-sony-com:serviceId:DigitalImaging',
    SCPDURL: '/DigitalImagingDesc.xml',
    controlURL: '/upnp/control/DigitalImaging',
    eventSubURL: ''
  }
 */
export interface SonyCamServiceListItem {
  serviceType: string;
  serviceId: string;
  SCPDURL: string;
  controlURL: string;
  eventSubURL: string;
}

/*
  {
    "av:X_ScalarWebAPI_ServiceType": "guide",
    "av:X_ScalarWebAPI_ActionList_URL": "http://192.168.122.1:8080/sony",
    "av:X_ScalarWebAPI_AccessType": ""
  },
  {
    "av:X_ScalarWebAPI_ServiceType": "accessControl",
    "av:X_ScalarWebAPI_ActionList_URL": "http://192.168.122.1:8080/sony",
    "av:X_ScalarWebAPI_AccessType": ""
  },
  {
    "av:X_ScalarWebAPI_ServiceType": "camera",
    "av:X_ScalarWebAPI_ActionList_URL": "http://192.168.122.1:8080/sony",
    "av:X_ScalarWebAPI_AccessType": ""
  },
  {
    "av:X_ScalarWebAPI_ServiceType": "system",
    "av:X_ScalarWebAPI_ActionList_URL": "http://192.168.122.1:8080/sony",
    "av:X_ScalarWebAPI_AccessType": ""
  },
  {
    "av:X_ScalarWebAPI_ServiceType": "avContent",
    "av:X_ScalarWebAPI_ActionList_URL": "http://192.168.122.1:8080/sony",
    "av:X_ScalarWebAPI_AccessType": ""
  }
 */
export interface SonyCamDeviceServiceListItem {
  "av:X_ScalarWebAPI_ServiceType": string;
  "av:X_ScalarWebAPI_ActionList_URL": string;
  "av:X_ScalarWebAPI_AccessType": string;
}

export interface SonyCamSpecIface {
  specVersion: {
    major: number;
    minor: number;
  };
  device: {
    deviceType: number;
    friendlyName: string;
    manufacturer: string;
    manufacturerURL: string;
    modelDescription: string;
    modelName: string;
    UDN: string;
    serviceList: {
      service: SonyCamServiceListItem[];
    };
    "av:X_ScalarWebAPI_DeviceInfo": {
      "av:X_ScalarWebAPI_Version": string;
      "av:X_ScalarWebAPI_ServiceList": {
        "av:X_ScalarWebAPI_Service": SonyCamDeviceServiceListItem[];
      };
      "av:X_ScalarWebAPI_ImagingDevice": {
        "av:X_ScalarWebAPI_LiveView_URL": string;
        "av:X_ScalarWebAPI_DefaultFunction": string;
      };
    };
  };
}

export async function fetchSonyCamSpec(
  location: string
): Promise<SonyCamSpecIface> {
  const res = await fetch(location);
  const text = await res.text();
  return parser.parse(text).root;
}
