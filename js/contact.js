// A mailto: link does nothing on a computer with no mail app set up, so also copy the address and say so.
(function () {
  var addr = 'm747.armaan@gmail.com';
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
    a.addEventListener('click', function () {
      var note = a.closest('section').querySelector('.copy-note');
      var done = function () { if (note) note.textContent = 'Address copied: ' + addr; };
      var fail = function () { if (note) note.textContent = 'Email: ' + addr; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, fail);
      else fail();
    });
  });
})();