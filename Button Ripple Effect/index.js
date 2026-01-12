const btnEl = document.querySelector('.btn');

btnEl.addEventListener('mouseover',(e)=>{
    const posLeft = e.pageX - btnEl.offsetLeft;
    const posTop = e.pageY - btnEl.offsetTop;

    
    btnEl.style.setProperty('--xPos', posLeft + 'px');
    btnEl.style.setProperty('--yPos', posTop + 'px');
})