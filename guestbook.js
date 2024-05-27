const guestForm = document.getElementById('guestForm'); 
const guestList = document.getElementById('guestList'); 
  
guestForm.addEventListener('submit', function (e) { 
    e.preventDefault(); 
  
    const name = document.getElementById('name').value; 
    const message = document.getElementById('message').value;
  
    const guestCard = document.createElement('div'); 
    guestCard.classList.add('guest-card'); 
    guestCard.innerHTML = ` 
                <h3>${name}</h3> 
                <p><strong>message:</strong> ${message}</p>`; 
  
    guestList.appendChild(guestCard); 
  
    guestForm.reset(); 
});
