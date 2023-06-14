

const name = 'bailey brooks';

$('button').click(() =>{
  let arr = [];
   let i = 0;
  const x = setInterval(y,100);
  
  function y(){
    if(i === name.length){
    clearInterval(x);
  } else{
    arr.push(name[i]);
    let output = arr.join('');
     $('h1').text(output)
    i += 1
    }
  } 
})