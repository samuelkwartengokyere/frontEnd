const hourEl = document.getElementById('hours')
const minuteEl = document.getElementById('minutes')
const secondsEl = document.getElementById('seconds')
const ampmEl = document.getElementById('ampm')

let time = new Date()



function updateClock(){
    let h = time.getHours()
    let m = time.getMinutes()
    let s = time.getSeconds()
    let _ampm = 'AM'

    if( h > 12){
        h = h - 12
        _ampm = 'PM'
    }

    h = h < 10 ? '0' + h : h

    hourEl.innerText = h
    minuteEl.innerText = m
    secondsEl.innerText = s
    ampmEl.innerText = _ampm


    setTimeout(()=>{
        updateClock()
    }, 1000)
}

updateClock()