const btnEl = document.querySelector('.btn');


btnEl.addEventListener('mouseover', (event)=>{
    const posLeft = event.pageX - btnEl.offsetLeft;
    const posTop = event.pageY - btnEl.offsetTop;


    btnEl.style.setProperty('--xPos', posLeft + 'px');
    btnEl.style.setProperty('--yPos', posTop + 'px');
})