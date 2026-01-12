const textAreaEl = document.getElementById('textarea')
const totalCharacter = document.getElementById('total-characters')
const remainingCharacter = document.getElementById('remaining-characters')

textAreaEl.addEventListener('keyup', ()=>{
    updateCounter();
})

updateCounter()

function updateCounter(){
    totalCharacter.innerText = textAreaEl.value.length

    remainingCharacter.innerText = textAreaEl.getAttribute('maxLength') - textAreaEl.value.length;

    
}

