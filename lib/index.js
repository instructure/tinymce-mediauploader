(function (document) {

  var REGEX_TYPE_VIDEO = /video\/*/;
  var REGEX_TYPE_IMAGE = /image\/*/;
  var REGEX_TYPE_AUDIO = /audio\/*/;
  var REGEX_URL = /^https?:\/\//;
  var REGEX_VIDEO = /\.(webm|ogg|mp4)$/i;
  var REGEX_IMAGE = /\.(jpe?g|png|gif)$/i;
  var REGEX_AUDIO = /\.(wav|mp3)$/i;
  var REGEX_YOUTUBE = /^https?:\/\/www.youtube.com\/watch\?v=(.+)|^https?:\/\/youtu.be\/(.+)/;
  var REGEX_VIMEO = /^https?:\/\/vimeo.com\/(\d+(\?.+)*)/;
  var REGEX_WISTIA = /^https?:\/\/\w+\.wistia\.com\/medias\/(.+)/;
  var REGEX_MESSAGE_TOKEN = /\*(.*?)\*/g;
  var DEFAULT_BUTTON_TEXT = '▶♫';

  //--------------------------------------------------
  // Plugin
  //--------------------------------------------------

  // Register media uploader plugin with TinyMCE
  tinymce.PluginManager.add('mediauploader', function (editor, url) {
    var image = getParam(editor, 'button_image');
    var text = getMessage(editor, 'button_text', DEFAULT_BUTTON_TEXT);

    editor.addCommand('InsertMediaUploader', function() {
      // Only allow one at a time
      var element = getDOMNode(editor);
      if (element) {
        element.focus();
        return;
      }

      renderComponent(editor);
      componentDidMount(editor);
    });

    editor.addButton('mediauploader', {
      image: image,
      title: getMessage(editor, 'button_title', 'Upload Media'),
      text: (image && text === DEFAULT_BUTTON_TEXT) ? null : text,
      onclick: function () {
        editor.execCommand('InsertMediaUploader');
      }
    });
  });

  //--------------------------------------------------
  // Component API
  //--------------------------------------------------

  /**
   * Render the component to the TinyMCE editor DOM
   *
   * @param {object} editor TinyMCE editor
   */
  function renderComponent(editor) {
    var msgAddMedia = getMessage(editor, 'msg_add_media', 'Add a video, image, or audio file');
    var msgPasteUrl = getMessage(editor, 'msg_paste_url', 'Paste URL');
    var msgDragDrop = getMessage(editor, 'msg_drag_drop', 'Drag and drop or *Upload a File*');

    editor.insertContent(
      '<div contenteditable="false" class="media-uploader" tabindex="-1" id="media-uploader">' +
        '<i class="media-uploader__close">&nbsp;</i>' +
        '<div class="media-uploader__type">' + msgAddMedia + '</div>' +
        '<div class="media-uploader__urlbox">' +
          '<input type="text" class="media-uploader__url" placeholder="' + msgPasteUrl + '" aria-label="' + msgPasteUrl + '"/>' +
          '<p class="error"></p>' +
        '</div>' +
        '<span class="media-uploader__prompt">' +
          msgDragDrop.replace(REGEX_MESSAGE_TOKEN,
            '<label tabindex="0">$1' +
              '<span class="media-uploader__file">' +
                '<input type="file" style="display: none;" accept="video/*,image/*,audio/*"/>' +
              '</span>' +
            '</label>'
          ) +
        '</span>' +
      '</div>'
    );
  }

  /**
   * Remove the component from the TinyMCE editor DOM
   *
   * @param {object} editor TinyMCE editor
   */
  function unmountComponent(editor) {
    var element = getDOMNode(editor);
    componentWillUnmount(editor);
    element.parentNode.removeChild(element);
  }

  /**
   * Lifecycle method to handle the component being removed from the DOM
   *
   * @param {object} editor TinyMCE editor
   */
  function componentWillUnmount(editor) {
    var element = getDOMNode(editor);

    element.ondragover = null;
    element.ondragend = null;
    element.ondrop = null;
    document.removeEventListener('dragover', eventPreventDefault);
    document.removeEventListener('drop', eventPreventDefault);

    try {
      element.querySelector('input[type=file]').onchange = null;
      element.querySelector('input[type=text]').onpaste = null;
    } catch (e) {
      // Error is probably from upload file modifying the DOM
    }
  }

  /**
   * Lifecycle method to handle the component being inserted to the DOM
   *
   * @param {object} editor TinyMCE editor
   */
  function componentDidMount(editor) {
    var doc = editor.iframeElement.contentDocument;
    var element = getDOMNode(editor);
    element.focus();

    document.addEventListener('dragover', eventPreventDefault);
    document.addEventListener('drop', eventPreventDefault);

    element.ondragover = function () {
      element.classList.add('media-uploader--dragover');
      return false;
    };

    element.ondragend = function () {
      element.classList.remove('media-uploader--dragover');
      return false;
    };

    element.ondrop = function (e) {
      element.classList.remove('media-uploader--dragover');
      e.preventDefault();

      uploadFile(editor, e.dataTransfer.files[0]);

      return false;
    };

    element.querySelector('.media-uploader__close').onclick = function () {
      unmountComponent(editor);
    };

    var fileInput = element.querySelector('input[type=file]');
    fileInput.onchange = function (e) {
      uploadFile(editor, e.target.files[0]);
    };

    var urlInput = element.querySelector('input[type=text]');
    urlInput.onpaste = function (e) {
      clearError(editor);
      setTimeout(function () {
        embedMedia(editor, urlInput.value);
      }, 0);
    };
    // keep the editor from hijacking key strokes
    urlInput.onkeydown = function (e) {
      e.stopPropagation();
    };
  }

  /**
   * Get the media uploader plugin widget's DOM node
   *
   * @param {object} editor TinyMCE editor
   * @return {element}
   */
  function getDOMNode(editor) {
    var doc = editor.iframeElement.contentDocument;
    return doc.getElementById('media-uploader');
  }

  /**
   * Replace the plugin widget with another element
   *
   * @param {object} editor TinyMCE editor
   * @param {element} newChild The child to replace plugin widget with
   */
  function replaceComponent(editor, newChild) {
    var element = getDOMNode(editor);
    componentWillUnmount(editor);
    element.parentNode.replaceChild(newChild, element);
  }

  //--------------------------------------------------
  // Upload/embed media
  //--------------------------------------------------

  // List of matchers to handle embedding media
  var matchers = (function () {
    function EmbedMatcher(regex, embed) {
      this.regex = regex;
      this.embed = embed;
    }

    function createMedia(tagName, src) {
      var media = document.createElement(tagName);
      media.src = src;
      return media;
    }

    function createIFrame(src, parentNode) {
      var width = parentNode.offsetWidth;
      var height = Math.floor((width / 16) * 9);
      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.width = width;
      iframe.height = height;
      iframe.frameborder = 0;
      iframe.allowfullscreen = true;
      return iframe;
    }

    return [
      new EmbedMatcher(REGEX_VIDEO, function (mediaUrl) {
        return createMedia('video', mediaUrl);
      }),
      new EmbedMatcher(REGEX_IMAGE, function (mediaUrl) {
        return createMedia('img', mediaUrl);
      }),
      new EmbedMatcher(REGEX_AUDIO, function (mediaUrl) {
        return createMedia('audio', mediaUrl);
      }),
      new EmbedMatcher(REGEX_YOUTUBE, function (mediaUrl, parentNode) {
        var matches = mediaUrl.match(REGEX_YOUTUBE);
        return createIFrame('//www.youtube.com/embed/' + (matches[1] || matches[2]), parentNode);
      }),
      new EmbedMatcher(REGEX_VIMEO, function (mediaUrl, parentNode) {
        var id = mediaUrl.match(REGEX_VIMEO)[1];
        return createIFrame('//player.vimeo.com/video/' + id, parentNode);
      }),
      new EmbedMatcher(REGEX_WISTIA, function (mediaUrl, parentNode) {
        var id = mediaUrl.match(REGEX_WISTIA)[1];
        return createIFrame('//fast.wistia.com/embed/iframe/' + id, parentNode);
      })
    ];
  })();

  /**
   * Upload a file from file input, or dragdrop behavior
   *
   * @param {object} editor TinyMCE editor
   * @param {File} file The file to be uploaded
   */
  function uploadFile(editor, file) {
    // Validate file type
    if (!REGEX_TYPE_VIDEO.test(file.type) &&
        !REGEX_TYPE_IMAGE.test(file.type) &&
        !REGEX_TYPE_AUDIO.test(file.type)) {
      alert(getParam(editor, 'msg_invalid_file', "That doesn't appear to be an accepted media file."));
      return;
    }

    var upload_file = getParam(editor, 'upload_file');
    if (typeof upload_file === 'function') {
      upload_file(getDOMNode(editor), file, function (fileUrl, error) {
        if (!error) {
          embedMedia(editor, fileUrl);
        } else {
          alert(error.message || error);
        }
      });
    } else {
      console.warn('Missing option "mediauploader_upload_file"');
    }
  }

  /**
   * Embed a media URL into TinyMCE
   *
   * @param {object} editor TinyMCE editor
   * @param {string} mediaUrl URL of the media to embed
   */
  function embedMedia(editor, mediaUrl) {
    var urlInput = getDOMNode(editor).querySelector('input[type=text]');
    // Validate media url
    if (!REGEX_URL.test(mediaUrl) &&
        !REGEX_YOUTUBE.test(mediaUrl) &&
        !REGEX_VIMEO.test(mediaUrl) &&
        !REGEX_WISTIA.test(mediaUrl)) {
      markError(editor, getMessage(editor, 'msg_invalid_url', "That doesn't appear to be a URL."));
      return;
    }

    var element = getDOMNode(editor);
    var media = null;

    for (var i=0, l=matchers.length; i<l; i++) {
      var matcher = matchers[i];
      if (matcher.regex.test(mediaUrl)) {
        media = matcher.embed(mediaUrl, element);
        break;
      }
    }

    if (!media) {
      markError(editor, getMessage(editor, 'msg_invalid_media', "That doesn't appear to be an embeddable URL."));
      urlInput.select();
    }

    replaceComponent(editor, media);

    var embed_media = getParam(editor, 'embed_media');
    if (typeof embed_media === 'function') {
      embed_media(media);
    }
  }

  /**
   * Clear any error messages
   *
   * @param {object} editor TinyMCE editor
   */
  function clearError(editor) {
    var input = getDOMNode(editor).querySelector('.media-uploader__url');
    input.classList.remove('error');
    input.parentNode.querySelector('p').innerHTML = '&nbsp;';
  }

  /**
   * Indicate that an error occured
   *
   * @param {object} editor TinyMCE editor
   * @param {string} message The error message to display
   */
  function markError(editor, message) {
    var input = getDOMNode(editor).querySelector('.media-uploader__url');
    input.classList.add('error');
    input.parentNode.querySelector('p').innerHTML = message;
    input.select();
  }

  /**
   * Get a plugin param value
   *
   * @param {object} editor TinyMCE editor
   * @param {string} key The key of the message param
   * @param {object} [fallback] The default value if the param is empty
   * @return {object} The plugin param value
   */
  function getParam(editor, key, fallback) {
    return editor.getParam('mediauploader_' + key) || fallback;
  }

  /**
   * Get an HTML safe message from plugin params
   *
   * @param {object} editor TinyMCE editor
   * @param {string} key The key of the message param
   * @param {string} [fallback] The default value if param is empty
   * @return {string} The plugin message
   */
  function getMessage(editor, key, fallback) {
    return escapeHTML(getParam(editor, key, fallback));
  }

  //--------------------------------------------------
  // Helpers
  //--------------------------------------------------

  // borrowed from handlebars.js
  var escapeHTML = (function () {
    var escape = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;'
    };

    var badChars = /[&<>"'`]/g;
    var possible = /[&<>"'`]/;

    function escapeChar(chr) {
      return escape[chr];
    }

    /**
     * Escape unsafe XSS characters from a string
     *
     * @param {string} string The string to escape
     * @return {string} The escaped string
     */
    return function (string) {
      if (typeof string !== 'string') {
        return string;
      }

      if (!possible.test(string)) { return string; }
      return string.replace(badChars, escapeChar);
    };
  })();

  /**
   * Prevent the default behavior for an event
   *
   * @param {object} e The event that needs to be preventDefault'd
   */
  function eventPreventDefault(e) {
    e.preventDefault();
  }

})(document);
