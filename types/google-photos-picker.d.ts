declare global {
  interface Window {
    gapi?: any;
    google?: {
      picker?: {
        PickerBuilder: new () => {
          addView: (view: any) => any;
          setOAuthToken: (token: string) => any;
          setDeveloperKey: (key: string) => any;
          setCallback: (callback: (data: any) => void) => any;
          build: () => {
            setVisible: (visible: boolean) => void;
          };
        };
        ViewId: {
          PHOTO_ALBUMS: any;
          PHOTOS: any;
          PHOTO_UPLOAD: any;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
      };
    };
  }
}

export {};
