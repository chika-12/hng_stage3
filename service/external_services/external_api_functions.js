const axios = require("axios")

const api = axios.create({
    timeout: 5000,
});

exports.genderise = async(name)=>{
    const response = await api.get(`https://api.genderize.io`, {params: {name}});
    return response.data
}

exports.agify = async(name)=>{
    const response = await api.get(`https://api.agify.io`, {params: {name}});
    return response.data
}

exports.nationalize = async(name)=>{
    const response = await api.get(`https://api.nationalize.io`, {params: {name}})
    return response.data
}