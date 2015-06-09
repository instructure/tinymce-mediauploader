(function () {
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

  function EmbedMatcher(regex, embed) {
    this.regex = regex;
    this.embed = embed;
  }

  var matchers = [
    new EmbedMatcher(REGEX_TYPE_VIDEO, function (mediaUrl) {
      return createMedia('video', mediaUrl);  
    }),
    new EmbedMatcher(REGEX_TYPE_IMAGE, function (mediaUrl) {
      return createMedia('img', mediaUrl);
    }),
    new EmbedMatcher(REGEX_TYPE_AUDIO, function (mediaUrl) {
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

  tinymce.PluginManager.add('mediauploader', function (editor, url) {
    editor.addButton('mediauploader', {
      image: getParam(editor, 'button_image'),
      title: getMessage(editor, 'button_title', 'Upload Media'),
      text: getMessage(editor, 'button_text'),
      onclick: function () {
        // Only allow one at a time
        var element = getDOMNode(editor);
        if (element) {
          element.focus();
          return;
        }

        renderComponent(editor);
        componentDidMount(editor);
      }
    });
  });

  function renderComponent(editor) {
    var msgAddMedia = getMessage(editor, 'add_media', 'Add a video, image, or audio file');
    var msgPasteUrl = getMessage(editor, 'paste_url', 'Paste URL');

    editor.insertContent(
      '<div contenteditable="false" class="media-uploader" tabindex="-1" id="media-uploader">' +
        '<i class="media-uploader__close">&nbsp;</i>' +
        '<div class="media-uploader__type">' + msgAddMedia + '</div>' +
        '<div class="media-uploader__urlbox">' +
          '<input type="text" class="media-uploader__url" placeholder="' + msgPasteUrl + '" aria-label="' + msgPasteUrl + '"/>' +
          '<p class="error"></p>' +
        '</div>' +
        '<span class="media-uploader__prompt">' +
          // TODO: How to allow custom i18n message with all the markup too?
          'Drag and drop or ' +
          '<label tabindex="0">' +
            'Upload a File' +
            '<span class="media-uploader__file">' +
              '<input type="file" style="display: none;" accept="video/*,image/*,audio/*"/>' +
            '</span>' +
          '</label>' +
        '</span>' +
      '</div>'
    );
  }

  function unmountComponent(editor) {
    var element = getDOMNode(editor);
    componentWillUnmount(editor);
    element.parentNode.removeChild(element);
  }

  function replaceComponent(editor, newChild) {
    var element = getDOMNode(editor);
    componentWillUnmount(editor);
    element.parentNode.replaceChild(newChild, element);
  }

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

  function componentDidMount(editor) {
    var doc = editor.iframeElement.contentDocument;
    var element = getDOMNode(editor);
    element.focus();

    var styleUrl = getParam(editor, 'style_url');
    if (styleUrl) {
      var link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('type', 'text/css');
      link.setAttribute('href', styleUrl);
      doc.head.appendChild(link);
    }

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

  function getDOMNode(editor) {
    var doc = editor.iframeElement.contentDocument;
    return doc.getElementById('media-uploader');
  }

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
  }

  function clearError(editor) {
    var input = getDOMNode(editor).querySelector('.media-uploader__url');
    input.classList.remove('error');
    input.parentNode.querySelector('p').innerHTML = '&nbsp;';
  }

  function markError(editor, message) {
    var input = getDOMNode(editor).querySelector('.media-uploader__url');
    input.classList.add('error');
    input.parentNode.querySelector('p').innerHTML = message;
    input.select();
  }

  function getParam(editor, key, fallback) {
    return editor.getParam('mediauploader_' + key) || fallback;
  }

  function getMessage(editor, key, fallback) {
    return escapeHTML(getParam(editor, key, fallback));
  }

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

    return function (string) {
      if (typeof string !== 'string') {
        return string;
      }

      if (!possible.test(string)) { return string; }
      return string.replace(badChars, escapeChar);
    };
  })();

  function eventPreventDefault(e) {
    e.preventDefault();
  }
})();
