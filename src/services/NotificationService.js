import PushNotification from 'react-native-push-notification';
import {Platform} from 'react-native';

class NotificationService {
  constructor() {
    this.configure();
    this.createChannel();
  }

  configure() {
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        notification.finish(PushNotification.FetchResult.NoData);
      },
      onAction: function (notification) {
        console.log('ACTION:', notification.action);
        console.log('NOTIFICATION:', notification);
      },
      onRegistrationError: function (err) {
        console.error(err.message, err);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  createChannel() {
    PushNotification.createChannel(
      {
        channelId: 'default-channel-id', // (required)
        channelName: 'Default channel', // (required)
        channelDescription: 'A default channel for notifications', // (optional) default: undefined.
        soundName: 'default', // (optional) See `soundName` parameter of `PushNotification.localNotification`
        importance: 4, // (optional) default: 4. Int value of the Android notification importance
        vibrate: true, // (optional) default: true. Creates the default vibration patten if true.
      },
      (created) => console.log(`createChannel returned '${created}'`), // (optional) callback returns whether the channel was created, false means it already existed.
    );
  }

  showLocalNotification(title, message) {
    PushNotification.localNotification({
      channelId: 'default-channel-id', // (required)
      title: title,
      message: message,
    });
  }

  requestPermissions() {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        PushNotification.requestPermissions();
    }
  }
}

export const notificationService = new NotificationService();
