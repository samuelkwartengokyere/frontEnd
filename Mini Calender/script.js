const monthName = document.querySelector('#month-name');
const dayName = document.querySelector('#day-name');
const dayNumber = document.querySelector('#day-number');
const yearEl = document.querySelector('#year');


console.log(`Month is ${monthName.innerHTML}`);  
console.log(`Day is ${dayName.innerHTML}`);  
console.log(`Day number is ${dayNumber.innerHTML}`);  
console.log(`Year is ${yearEl.innerHTML}`);  


// date object

const date = new Date();

 const month = date.getMonth();
 const day = date.getDay();
 const _date = date.getDate();
 const _year = date.getFullYear();

 updateCalendar();

function updateCalendar(){
    monthName.innerHTML = date.toLocaleString('en', {
        month: 'long'
    });

    dayName.innerHTML = date.toLocaleString('en',{
        weekday: 'long'
    });

    dayNumber.innerText = _date;

    yearEl.innerHTML = _year;
} 











