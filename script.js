document.addEventListener('DOMContentLoaded', function() {
    const cursorCircle = document.getElementById('cursorCircle');
    document.addEventListener('mousemove', function(e) {
      cursorCircle.style.left = e.pageX + 'px';
      cursorCircle.style.top = e.pageY + 'px';
      cursorCircle.style.display = 'block';
    });
  
    const links = document.querySelectorAll('a');
    document.addEventListener('mousemove', function(e) {
      let closestDistance = Infinity;
      links.forEach(link => {
        const rect = link.getBoundingClientRect();
        const linkX = rect.left + rect.width / 2;
        const linkY = rect.top + rect.height / 2;
        const distance = Math.sqrt(Math.pow(linkX - e.pageX, 2) + Math.pow(linkY - e.pageY, 2));
        if (distance < closestDistance) {
          closestDistance = distance;
        }
      });
      const size = Math.max(20, Math.min(100, 100 - closestDistance));
      cursorCircle.style.width = size + 'px';
      cursorCircle.style.height = size + 'px';
    });
  });
  