const containerEl = document.querySelector('.container')


for(index = 0; index < 30; index++){
    const colorContainerEl = document.createElement('div')

    colorContainerEl.classList.add('color-container')

    containerEl.appendChild(colorContainerEl)
}

const colorContainerEls = document.querySelector('.color-container')

generateColor()

function generateColor(){
    colorContainerEls.forEach(
        (colorContainerEl) => {
        const newColorCode = randomNumber()

        colorContainerEl.style.backgroundColor = '#' + newColorCode;

        colorContainerEl.innerText = '#' + newColorCode;
    });
}

function randomNumber(){
    const chars = '0123456789abcdef'
    const codeLength = 6;
    let colorCode = ''

    for(index = 0; index < codeLength; index++){
        const randomNum = Math.floor(Math.random()* chars.length)
        colorCode += chars.substring(randomNum, randomNum + 1)
    }
    return colorCode;
}