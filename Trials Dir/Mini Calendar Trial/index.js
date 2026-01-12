const monthEl = document.querySelector('#month-name');
const dayEl = document.querySelector('#day-name');
const dateEl = document.querySelector('#date');
const yearEl = document.querySelector('#year');


// construct a new date object

const date = new Date();

const _date = date.getDate();
const _year = date.getFullYear();

console.log(_date)

updateCalendar();

function updateCalendar(){

    monthEl.innerHTML = date.toLocaleString('en',{
        month: 'long'
    });

    dayEl.innerHTML = date.toLocaleString('en',{
        weekday:'long'
    });

    dateEl.innerText = _date;

    yearEl.innerText = _year;
}