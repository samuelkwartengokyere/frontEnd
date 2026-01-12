const imageContainerEl = document.querySelector('.image-container')

const prevBtn = document.querySelector('#prev')
const nextBtn = document.querySelector('#next')

let x = 0;
let timer;

prevBtn.addEventListener('click', ()=>{
    x += 45;
    clearTimeout(timer)
    updateGallery()
})

nextBtn.addEventListener('click', ()=>{
    x -= 45;
    clearTimeout(timer)
    updateGallery()
})

function updateGallery(){
    imageContainerEl.style.transform = `perspective(1000px) rotateY(${x}deg)`;


    timer = setTimeout(()=>{
        x -= 45;
        updateGallery()
    }, 2000)
}

updateGallery()



