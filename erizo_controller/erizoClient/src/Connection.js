/* global window, chrome, navigator */
import ChromeStableStack from './webrtc-stacks/ChromeStableStack';
import FirefoxStack from './webrtc-stacks/FirefoxStack';
import FcStack from './webrtc-stacks/FcStack';
import Logger from './utils/Logger';


let ErizoSessionId = 103;

const getBrowser = () => {
  let browser = 'none';

  if ((typeof module !== 'undefined' && module.exports)) {
    browser = 'fake';
  } else if (window.navigator.userAgent.match('Firefox') !== null) {
    // Firefox
    browser = 'mozilla';
  } else if (window.navigator.userAgent.match('Chrome') !== null) {
    browser = 'chrome-stable';
    if (window.navigator.userAgent.match('Electron') !== null) {
      browser = 'electron';
    }
  } else if (window.navigator.userAgent.match('Safari') !== null) {
    browser = 'safari';
  } else if (window.navigator.userAgent.match('AppleWebKit') !== null) {
    browser = 'safari';
  }
  return browser;
};

const buildConnection = (specInput) => {
  let that = {};
  const spec = specInput;
  ErizoSessionId += 1;
  spec.sessionId = ErizoSessionId;

  // Check which WebRTC Stack is installed.
  that.browser = getBrowser();
  if (that.browser === 'fake') {
    Logger.warning('Publish/subscribe video/audio streams not supported in erizofc yet');
    that = FcStack(spec);
  } else if (that.browser === 'mozilla') {
    Logger.debug('Firefox Stack');
    that = FirefoxStack(spec);
  } else if (that.browser === 'safari') {
    Logger.debug('Safari using Firefox Stack');
    that = FirefoxStack(spec);
  } else if (that.browser === 'chrome-stable' || that.browser === 'electron') {
    Logger.debug('Chrome Stable Stack');
    that = ChromeStableStack(spec);
  } else {
    Logger.error('No stack available for this browser');
    throw new Error('WebRTC stack not available');
  }
  if (!that.updateSpec) {
    that.updateSpec = (newSpec, callback = () => {}) => {
      Logger.error('Update Configuration not implemented in this browser');
      callback('unimplemented');
    };
  }

  return that;
};

const GetUserMedia = (config, callback = () => {}, error = () => {}) => {
  let screenConfig;

  const getUserMedia = (userMediaConfig, cb, errorCb) => {
    navigator.mediaDevices.getUserMedia(userMediaConfig).then(cb).catch(errorCb);
  };

  const configureScreensharing = () => {
    Logger.debug('Screen access requested');
    switch (getBrowser()) {
      case 'electron' :
        Logger.debug('Screen sharing in Electron');
        screenConfig = {};
        screenConfig.video = config.video || {};
        screenConfig.video.mandatory = config.video.mandatory || {};
        screenConfig.video.mandatory.chromeMediaSource = 'screen';
        getUserMedia(screenConfig, callback, error);
        break;
      case 'mozilla':
        Logger.debug('Screen sharing in Firefox');
        screenConfig = {};
        if (config.video !== undefined) {
          screenConfig.video = config.video;
          screenConfig.video.mediaSource = 'window' || 'screen';
        } else {
          screenConfig = {
            audio: config.audio,
            video: { mediaSource: 'window' || 'screen' },
          };
        }
        getUserMedia(screenConfig, callback, error);
        break;

      case 'chrome-stable':
        Logger.debug('Screen sharing in Chrome');
        screenConfig = {};
        if (config.desktopStreamId) {
          screenConfig.video = config.video || { mandatory: {} };
          screenConfig.video.mandatory = screenConfig.video.mandatory || {};
          screenConfig.video.mandatory.chromeMediaSource = 'desktop';
          screenConfig.video.mandatory.chromeMediaSourceId = config.desktopStreamId;
          getUserMedia(screenConfig, callback, error);
        } else {
          // Default extensionId - this extension is only usable in our server,
          // please make your own extension based on the code in
          // erizo_controller/erizoClient/extras/chrome-extension
          let extensionId = 'okeephmleflklcdebijnponpabbmmgeo';
          if (config.extensionId) {
            Logger.debug(`extensionId supplied, using ${config.extensionId}`);
            extensionId = config.extensionId;
          }
          Logger.debug('Screen access on chrome stable, looking for extension');
          try {
            chrome.runtime.sendMessage(extensionId, { getStream: true },
              (response) => {
                if (response === undefined) {
                  Logger.error('Access to screen denied');
                  const theError = { code: 'Access to screen denied' };
                  error(theError);
                  return;
                }
                const theId = response.streamId;
                if (config.video.mandatory !== undefined) {
                  screenConfig.video = config.video;
                  screenConfig.video.mandatory.chromeMediaSource = 'desktop';
                  screenConfig.video.mandatory.chromeMediaSourceId = theId;
                } else {
                  screenConfig = { video: { mandatory: { chromeMediaSource: 'desktop',
                    chromeMediaSourceId: theId } } };
                }
                getUserMedia(screenConfig, callback, error);
              });
          } catch (e) {
            Logger.debug('Screensharing plugin is not accessible ');
            const theError = { code: 'no_plugin_present' };
            error(theError);
          }
        }
        break;

      default:
        Logger.error('This browser does not support ScreenSharing');
    }
  };

  if (config.screen) {
    configureScreensharing();
  } else if (typeof module !== 'undefined' && module.exports) {
    Logger.error('Video/audio streams not supported in erizofc yet');
  } else {
    Logger.debug('Calling getUserMedia with config', config);
    getUserMedia(config, callback, error);
  }
};
const Connection = { GetUserMedia, buildConnection, getBrowser };

export default Connection;
