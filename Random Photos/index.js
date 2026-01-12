const imageContainerEl = document.querySelector('.image-container')

const btnEl = document.querySelector('.btn')


btnEl.addEventListener('click', (e)=>{
    e.preventDefault()

    imageNumber = 10
    addNewImage()

})

function addNewImage(){
    for(index = 0; index < imageNumber; index++){
        const newImageEl = document.createElement('img')

        newImageEl.src = `https://picsum.photos/300?random=${Math.floor(Math.random()*2000)}`

        imageContainerEl.appendChild(newImageEl)
    }
    
}