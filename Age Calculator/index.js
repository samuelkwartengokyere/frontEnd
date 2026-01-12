const btnEl = document.getElementById('btn')
const birthdayEl = document.getElementById('birthday')
const resultEl = document.getElementById('result')

function calculateAge(){
    const birthdayValue = birthdayEl.value

    if(birthdayValue === ''){
        alert('Please enter a valid birth date')
    }else{
       const age = getAge(birthdayValue)
       resultEl.innerHTML = `You're ${age} ${age > 1 ? 'years' : 'year'} old`

       resultEl.style.display = 'block'

       setTimeout(()=>{
        resultEl.style.display = 'none'
       }, 6000)
    }
}


function getAge(birthdayValue){
    const currentDate = new Date()
    const birthdayDate = new Date(birthdayValue)

    // console.log(birthdayDate.getFullYear())

    let age = currentDate.getFullYear() - birthdayDate.getFullYear()

    const month = currentDate.getMonth() - birthdayDate.getMonth()


    if(month < 0 || (month === 0 && currentDate.getDate() < birthdayDate.getDate())){
        age--
    }

    return(age)
}

btnEl.addEventListener('click', calculateAge)