# tinymce-mediauploader

Media Uploader plugin for TinyMCE

## Demo

http://instructure.github.io/tinymce-mediauploader

## Example

```js
tinymce.init({
  selector: 'textarea',
  plugins: 'link mediauploader',
  toolbar: 'bold italic bullist numlist link mediauploader',

  // Path to CSS file to customize plugin widget appearance, see 
  // `lib/styles.css` for available selectors and example styling
  //
  // http://www.tinymce.com/wiki.php/Configuration:content_css for more info
  content_css: '//example.com/path/to/style.css'

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
  }
});
```

## Options

#### `mediauploader_upload_file`

**Required**

This is the `function` that will handle files that need to be uploaded. See the example above for signature, and usage.

#### `mediauploader_embed_media`

This `function` is called anytime media is embeded into the editor. It takes the media `element` as it's only argument.

#### `mediauploader_button_image`

This is the url of an image to be used as the toolbar button for the plugin.

#### `mediauploader_button_title`

This is the title of the toolbar button which is displayed as a tooltip on hover.

#### `mediauploader_button_text`

This is the text of the toolbar button. If text and image options are provided, text will take precedence.

#### `mediauploader_msg_add_media`

This is used as the message providing instruction when the plugin widget is rendered. The default is `"Add a video, image, or audio file"`.

#### `mediauploader_msg_paste_url`

This is the placeholder used for the text input that handle pasting a media url. The default is `"Paste URL"`.

#### `mediauploader_msg_drag_drop`

This is the message instructing user how to upload a file. The default is `"Drag and drop or *Upload a File*"`.

**Note:** Text within * will be wrapped in markup to activate file input

#### `mediauploader_msg_invalid_file`

This is the message that appears if the user attempts to upload an invalid media file. The default is `"That doesn't appear to be an accepted media file"`.

#### `mediauploader_msg_invalid_url`

This is the message that appears if the user attempts to paste an invalid URL. The default is `"That doesn't appear to be a URL"`.

#### `mediauploader_msg_invalid_media`

This is the message that appears if the user attempts to embed an unsupported media type. The default is `"That doesn't appear to be an embeddable URL"`.

## License

MIT
