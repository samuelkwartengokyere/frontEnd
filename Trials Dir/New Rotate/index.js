const imageContainerEl = document.querySelector('.image-container')

const prevBtn =document.getElementById('prev')
const nextBtn = document.getElementById('next')

let x = 0;
let timer;

prevBtn.addEventListener('click', ()=>{
    x += 45
    clearTimeout(timer)
    updateGallery()

})



nextBtn.addEventListener('click', ()=>{
    x -= 45
    clearTimeout(timer)
    updateGallery()
})

updateGallery()

function updateGallery(){
    imageContainerEl.style.transform = `perspective(1000px) rotateY(${x}deg)`


   timer = setTimeout(()=>{
        x -= 45
        updateGallery()
    }, 4000)
}