class UAPayloadCreator {
  createDevicePushPayload({ os, message, channelId }) {
    const payload = {
      audience: {},
      notification: {}
    };

    if (os === 'android') {
      payload.audience.android_channel = channelId;
    } else if (os === 'ios') {
      payload.audience.ios_channel = channelId;
    }

    payload.notification.alert = String(message || '');
    payload.device_types = [os];
    return payload;
  }

  createNamedUserPushPayload({ os, message, namedUser }) {
    const payload = {
      audience: {},
      notification: {}
    };

    if (os && !Array.isArray(os)) {
      os = [os];
    }
    payload.audience.named_user = namedUser;
    payload.notification.alert = String(message || '');
    payload.device_types = ['ios', 'android', 'web', 'amazon'];
    return payload;
  }

  createDisassociateNamedUserPayload({ channelId, deviceType, namedUserId }) {
    const payload = {
      channel_id: channelId
    };
    if (deviceType) {
      payload.device_type = deviceType;
    }
    if (namedUserId) {
      payload.named_user_id = namedUserId;
    }
    return payload;
  }
}

module.exports = new UAPayloadCreator();
