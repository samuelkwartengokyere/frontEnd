const yearEl = document.querySelector('.year')

const daysEl = document.getElementById('day')
const hoursEl = document.getElementById('hour')
const minutesEl = document.getElementById('minute')
const secondsEl = document.getElementById('seconds')


const newYearTime = new Date('Jan, 1 2027 00:00:00')

updateCountDown()

function updateCountDown(){
    yearEl.innerText = new Date().getFullYear()
    const now = new Date().getTime();

    const gap = newYearTime - now;


    const seconds = 1000;
    const minute = seconds * 60;
    const hour = minute * 60;
    const day = hour * 24;


    const d = Math.floor(gap/day)
    const h = Math.floor((gap % day)/hour)
    const m = Math.floor((gap % hour)/ minute)
    const s = Math.floor((gap % minute)/ seconds)


    daysEl.innerText = d;
    hoursEl.innerText = h;
    minutesEl.innerText = m;
    secondsEl.innerText = s;



    setTimeout(updateCountDown, 1000)
}