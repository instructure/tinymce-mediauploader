# tinymce-mediauploader

Media Uploader plugin for TinyMCE

## Example

```js
tinymce.init({
  selector: 'textarea',
  plugins: 'link mediauploader',
  toolbar: 'bold italic bullist numlist link mediauploader',

  // plugin specific options

  /**
    * Handle a file being uploaded by the plugin
    *
    * @param {Element} widget The element that represents the plugin widget
    * @param {File} file The file to be uploaded
    * @param {function} callback The callback to invoke once the file has been uploaded
    */
  mediauploader_upload_file: function (widget, file, callback) {
    widget.innerHTML = 'Uploading...';

    // Do your upload logic here instead of setTimeout

    setTimeout(function () {
      /**
        * Callback to let plugin know the upload is complete
        *
        * @param {string} fileUrl The URL to the file to be included
        * @param {Error|string} [error] The Error object or string in the event an error occurred
        */
      callback('https://pbs.twimg.com/profile_images/2221189782/beavis_butthead.jpg');
    }, 2500);
  },

  // custom messages to support i18n, defaults will be used if no custom message is provided
  mediauploader_msg_invalid_file: "That file type isn't supported",
  mediauploader_msg_invalid_url: "That's a bad URL",
  mediauploader_msg_invalid_media: "That can't be embeded"
});
```
