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
      text: 'Upload',
      title: 'Upload Media',
      icon: false,
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
    editor.insertContent(
      '<div contenteditable="false" class="media-uploader" tabindex="-1" id="media-uploader">' +
        '<i class="media-uploader__close">&nbsp;</i>' +
        '<div class="media-uploader__type">Add a video, image, or audio file</div>' +
        '<div class="media-uploader__urlbox">' +
          '<input type="text" class="media-uploader__url" placeholder="Paste URL" aria-label="Paste URL"/>' +
          '<p class="error"></p>' +
        '</div>' +
        '<span class="media-uploader__prompt">' +
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
    element.querySelector('input[type=file]').onchange = null;
    element.querySelector('input[type=text]').onpaste = null;
    document.removeEventListener('dragover', eventPreventDefault);
    document.removeEventListener('drop', eventPreventDefault);
  }

  function componentDidMount(editor) {
    var doc = editor.iframeElement.contentDocument;
    var element = getDOMNode(editor);

    // TODO this sucks, there's got to be a better way
    doc.head.appendChild(document.getElementById('media-uploader-styles').cloneNode(true));

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
      alert(getMsgParam(editor, 'invalid_file', "That doesn't appear to be an accepted media file."));
      return;
    }

    var upload_file = editor.getParam('mediauploader_upload_file');
    if (typeof upload_file === 'function') {
      upload_file(file, function (fileUrl, error) {
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
      markError(editor, getMsgParam(editor, 'invalid_url', "That doesn't appear to be a URL."));
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
      markError(editor, getMsgParam(editor, 'invalid_media', "That doesn't appear to be an embeddable URL."));
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

  function getMsgParam(editor, key, fallback) {
    return editor.getParam('mediauploader_msg_' + key) || fallback;
  }

  function eventPreventDefault(e) {
    e.preventDefault();
  }
})();
