const textareaEl = document.getElementById('textarea')
const totalCharacters = document.getElementById('total-characters')
const remainingCharacters = document.getElementById('remaining-characters')


textareaEl.addEventListener('keyup', ()=>{
    updateCounter()
})

updateCounter()

function updateCounter(){
    totalCharacters.innerText = textareaEl.value.length;

    remainingCharacters.innerText = textareaEl.getAttribute('maxLength') - textareaEl.value.length
}