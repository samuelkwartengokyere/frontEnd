const inputEl = document.querySelector('.input')

const bodyEl = document.querySelector('body')
inputEl.checked = JSON.parse(localStorage.getItem('mode'))




inputEl.addEventListener('input', ()=>{
    updateBody()
    updateLocalStorage()
})

function updateBody(){
    if(inputEl.checked){
        bodyEl.style.backgroundColor = 'black'
    }else{
        bodyEl.style.backgroundColor = 'white'
    }
}

function updateLocalStorage(){
    localStorage.setItem('mode',
        JSON.stringify(inputEl.checked)
    );
}