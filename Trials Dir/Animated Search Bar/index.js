const containerEl = document.querySelector('.container')

const magnifierEl = document.getElementById('magnifier')


magnifierEl.addEventListener('click', ()=>{
    containerEl.classList.toggle('active')
})