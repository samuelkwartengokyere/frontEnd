const containerEl = document.querySelector('.container')
const rightEl = document.querySelector('.right')
const leftEl = document.querySelector('.left')


scaleRight()
scaleLeft()

function scaleRight(){
        rightEl.addEventListener('mouseenter', ()=>{
            containerEl.classList.add('active-right')
        })

    rightEl.addEventListener('mouseleave', ()=>{
        containerEl.classList.remove('active-right')
    })
}

function scaleLeft(){

    leftEl.addEventListener('mouseenter', ()=>{
        containerEl.classList.add('active-left');
    })

    leftEl.addEventListener('mouseleave', ()=>{
        containerEl.classList.remove('active-left')
    })

}
